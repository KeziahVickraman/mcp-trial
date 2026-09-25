import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { carpark, ev } from "../lib/lta.js";

/**
 * Model Context Protocol (MCP) Streamable HTTP Server Endpoint
 * Exposes read-only tools for discovering Singapore carparks and EV chargers.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed"
        },
        id: null
      })
    );
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
