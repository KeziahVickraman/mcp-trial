import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Agent endpoint that connects to external MCP servers and answers
 * questions using Gemini 3.8 Flash with automatic tool calling.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
    return;
  }

  // 1. Verify GEMINI_API_KEY
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "GEMINI_API_KEY is not set. Add it in Vercel and redeploy."
      })
    );
    return;
  }

  // 2. Validate question parameter
  const question = req.body?.question;
  if (
    !question ||
    typeof question !== "string" ||
    question.trim().length === 0 ||
    question.length > 500
  ) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Question is required and must not exceed 500 characters."
      })
    );
    return;
  }

  const rawMcpServers = process.env.MCP_SERVERS || "https://mcp-trial-ebon.vercel.app/api/mcp,https://chatwithsandra.singstat.gov.sg/mcp";
  const addresses = rawMcpServers
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const connectedClients = [];
  const unavailable = [];

  // Helper to connect a client with an 8-second timeout
  const connectClientWithTimeout = (client, transport, timeoutMs = 8000) => {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);

      try {
        await client.connect(transport);
        clearTimeout(timer);
        resolve();
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  };

  try {
    // 3. Connect to MCP servers
    for (const address of addresses) {
      let client = null;
      try {
        const url = new URL(address);
        client = new Client({ name: "g8-agent", version: "1.0.0" });
        const transport = new StreamableHTTPClientTransport(url);
        await connectClientWithTimeout(client, transport, 8000);
        connectedClients.push(client);
      } catch (err) {
        if (client) {
          try {
            await client.close();
          } catch (_) {}
        }
        unavailable.push({
          address,
          reason: err?.message || "Connection failed"
        });
      }
    }

    // 4. Configure Gemini
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const systemInstruction =
      "Answer only from tool results. Give the source and the fetched_at time for every figure. If a tool returns an error or nothing, say so in one sentence and do not guess. Answer in at most 120 words.";

    const config = {
      systemInstruction
    };

    if (connectedClients.length > 0) {
      config.tools = [mcpToTool(...connectedClients)];
      config.automaticFunctionCalling = { maximumRemoteCalls: 6 };
    }

    // 5. Call Gemini
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: question,
        config
      });
    } catch (err) {
      const status = err?.status || 502;
      const reason = err?.message?.split("\n")[0] || "Gemini model execution failed";
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: `Gemini error (${status}): ${reason}`,
          status
        })
      );
      return;
    }

    // 6. Build tool_calls from automaticFunctionCallingHistory
    const tool_calls = [];
    const history = response.automaticFunctionCallingHistory || [];

    const responsesById = new Map();
    const responsesByName = [];

    for (const turn of history) {
      if (Array.isArray(turn.parts)) {
        for (const part of turn.parts) {
          if (part.functionResponse) {
            if (part.functionResponse.id) {
              responsesById.set(part.functionResponse.id, part.functionResponse);
            }
            responsesByName.push(part.functionResponse);
          }
        }
      }
    }

    let nameCursor = 0;
    for (const turn of history) {
      if (Array.isArray(turn.parts)) {
        for (const part of turn.parts) {
          if (part.functionCall) {
            const call = part.functionCall;
            let matched = null;
            if (call.id && responsesById.has(call.id)) {
              matched = responsesById.get(call.id);
            } else {
              matched = responsesByName.find(
                (r, idx) => idx >= nameCursor && r.name === call.name
              );
              nameCursor++;
            }

            let failed = false;
            if (matched) {
              const resp = matched.response;
              if (resp) {
                if (resp.error || resp.isError === true) {
                  failed = true;
                } else if (resp.result && (resp.result.error || resp.result.isError === true)) {
                  failed = true;
                } else if (typeof resp === "string") {
                  if (resp.toLowerCase().includes("failed") || resp.toLowerCase().includes("error")) {
                    failed = true;
                  }
                } else if (Array.isArray(resp.content)) {
                  for (const c of resp.content) {
                    if (c?.type === "text" && typeof c.text === "string") {
                      if (c.text.toLowerCase().includes("failed") || c.text.toLowerCase().includes("error")) {
                        failed = true;
                      }
                    }
                  }
                }
              }
            }

            tool_calls.push({
              name: call.name,
              args: call.args || {},
              failed
            });
          }
        }
      }
    }

    const answered_at = new Date().toISOString();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        answer: response.text || "",
        tool_calls,
        unavailable,
        model: "gemini-3.8-flash",
        answered_at
      })
    );
  } finally {
    // 7. Close every client in finally block
    for (const client of connectedClients) {
      try {
        await client.close();
      } catch (_) {}
    }
  }
}
