import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { carpark, ev } from "../lib/lta.js";

/**
 * Model Context Protocol (MCP) Streamable HTTP Server Endpoint
 * Exposes read-only tools for discovering Singapore carparks and EV chargers.
 */
export default async function handler(req, res) {
  // 1. Universal CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Mcp-Session-Id, x-api-key, Last-Event-ID"
  );

  // 2. Handle HTTP OPTIONS preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const serverInfo = {
    name: "g8-server",
    version: "1.0.0",
    protocol: "mcp-streamable-http",
    protocolVersion: "2024-11-05",
    transport: "Streamable HTTP (JSON-RPC 2.0)"
  };

  const publishedTools = [
    {
      name: "g8_find_carparks",
      description:
        "Returns up to 10 carpark locations with current lot availability sorted by distance from the specified coordinates. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall CarParkAvailabilityv2 API.",
      readOnly: true,
      parameters: {
        lat: "number (required)",
        lng: "number (required)",
        radius_m: "number (optional, default: 1000)",
        min_lots: "number (optional, default: 0)"
      }
    },
    {
      name: "g8_find_ev_chargers",
      description:
        "Returns up to 10 electric vehicle charging station locations sorted by distance without nested connector details. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall EV Charging API.",
      readOnly: true,
      parameters: {
        lat: "number (required)",
        lng: "number (required)",
        radius_m: "number (optional, default: 1500)",
        plug_type: "string (optional, e.g. 'Type 2' or 'CCS2')"
      }
    },
    {
      name: "g8_draft_alert",
      description:
        "Drafts an alert notification for external distribution based on transport or parking data. Does not send anything. Returns the draft with draft_id for human approval.",
      humanInTheLoop: true,
      parameters: {
        subject: "string (required)",
        message: "string (required)",
        based_on: "string (required)"
      }
    }
  ];

  const connectionMessage = {
    status: "connected",
    message: "MCP Streamable HTTP Server connected successfully",
    server: serverInfo,
    connection: {
      status: "connected",
      connected_at: new Date().toISOString(),
      endpoint: "/api.mcp",
      alternate_endpoint: "/api/mcp",
      state: "ready"
    },
    tools: publishedTools,
    jsonrpc: "2.0",
    id: null,
    result: {
      status: "connected",
      message: "MCP Streamable HTTP Server connected successfully",
      serverInfo: {
        name: "g8-server",
        version: "1.0.0"
      },
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: true
        }
      }
    }
  };

  // 3. Handle GET / HEAD (Connection handshake, health inspection, SSE connection)
  if (req.method === "GET" || req.method === "HEAD") {
    // If the client requested Server-Sent Events (SSE)
    if (req.headers && req.headers.accept && req.headers.accept.includes("text/event-stream")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      });

      // Send initial endpoint and connection message events
      res.write(`event: endpoint\ndata: /api.mcp\n\n`);
      res.write(`event: connection\ndata: ${JSON.stringify(connectionMessage)}\n\n`);

      const keepAlive = setInterval(() => {
        try {
          res.write(`: keep-alive\n\n`);
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);

      res.on("close", () => {
        clearInterval(keepAlive);
      });
      return;
    }

    // Standard HTTP GET connection message
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(connectionMessage, null, 2));
    return;
  }

  // 4. Handle POST requests (MCP JSON-RPC tools and initialization)
  if (req.method === "POST") {
    // If empty body sent, respond with connection confirmation
    if (!req.body || (typeof req.body === "object" && Object.keys(req.body).length === 0)) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify(connectionMessage, null, 2));
      return;
    }
  } else {
    // Other HTTP methods
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(connectionMessage, null, 2));
    return;
  }

  // Ensure Accept header includes text/event-stream if needed by Streamable HTTP
  if (req.headers) {
    if (!req.headers.accept || req.headers.accept === "*/*") {
      req.headers.accept = "application/json, text/event-stream";
    } else if (!req.headers.accept.includes("text/event-stream")) {
      req.headers.accept = `${req.headers.accept}, text/event-stream`;
    }
  }

  // Create new McpServer fresh on every request; this server keeps no sessions
  const server = new McpServer({
    name: "g8-server",
    version: "1.0.0"
  });

  // Tool 1: g8_find_carparks
  server.registerTool(
    "g8_find_carparks",
    {
      description:
        "Returns up to 10 carpark locations with current lot availability sorted by distance from the specified coordinates. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall CarParkAvailabilityv2 API. Use this tool when a user needs to find nearby parking spaces or check real-time lot availability around a location in Singapore. This tool does not provide parking fee calculations or reserved lot booking capabilities.",
      inputSchema: {
        lat: z.number().describe("Latitude coordinate of search center in Singapore (e.g. 1.293)"),
        lng: z.number().describe("Longitude coordinate of search center in Singapore (e.g. 103.857)"),
        radius_m: z.number().optional().describe("Search radius around coordinates in meters (e.g. 1000)"),
        min_lots: z.number().optional().describe("Minimum number of available lots required (e.g. 5)")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      }
    },
    async ({ lat, lng, radius_m, min_lots }) => {
      try {
        const result = await carpark({ lat, lng, radius_m, min_lots });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (err) {
        const status = err.status || 500;
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to fetch carpark data from LTA DataMall with status ${status}.`
            }
          ]
        };
      }
    }
  );

  // Tool 2: g8_find_ev_chargers
  server.registerTool(
    "g8_find_ev_chargers",
    {
      description:
        "Returns up to 10 electric vehicle charging station locations sorted by distance without nested connector details. Data is read directly from Singapore's Land Transport Authority (LTA) DataMall EV Charging API. Use this tool when a user wants to find nearby EV charging stations or locate charging points compatible with a specific plug type in Singapore. This tool does not provide real-time session initiation, charging payment processing, or live connector occupancy states.",
      inputSchema: {
        lat: z.number().describe("Latitude coordinate of search center in Singapore (e.g. 1.293)"),
        lng: z.number().describe("Longitude coordinate of search center in Singapore (e.g. 103.857)"),
        radius_m: z.number().optional().describe("Search radius around coordinates in meters (e.g. 1500)"),
        plug_type: z.string().optional().describe("Plug or connector type to filter by such as Type 2 or CCS2")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true
      }
    },
    async ({ lat, lng, radius_m, plug_type }) => {
      try {
        const result = await ev({ lat, lng, radius_m, plug_type });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (err) {
        const status = err.status || 500;
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Failed to fetch EV charging data from LTA DataMall with status ${status}.`
            }
          ]
        };
      }
    }
  );

  // Tool 3: g8_draft_alert
  server.registerTool(
    "g8_draft_alert",
    {
      description:
        "Drafts an alert notification for external distribution based on transport or parking data. Does not send anything. Returns the draft with draft_id for human approval.",
      inputSchema: {
        subject: z.string().describe("Subject line of the alert"),
        message: z.string().describe("Alert message content"),
        based_on: z.string().describe("The tool results the alert relies on, as text")
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ subject, message, based_on }) => {
      const draft_id = "draft_" + Math.random().toString(36).substring(2, 10);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ draft_id, subject, message, based_on })
          }
        ]
      };
    }
  );

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
