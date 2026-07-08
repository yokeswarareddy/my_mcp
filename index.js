import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// ================================
// Create MCP Server
// ================================
const mcpServer = new Server(
  {
    name: "template-fetcher-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ================================
// Register Tool
// ================================
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_template_names",
        description:
          "Fetches the HTML from a website containing ASKEM templates.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Website URL to fetch templates from",
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

// ================================
// Tool Execution
// ================================
mcpServer.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    if (request.params.name !== "get_template_names") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Unknown tool.",
          },
        ],
      };
    }

    try {
      const { url } = request.params.arguments;

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      return {
        content: [
          {
            type: "text",
            text: response.data,
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  }
);

// ================================
// Express App
// ================================
const app = express();
app.use(express.json());

// Health Check
app.get("/", (req, res) => {
  res.json({
    status: "running",
    server: "Template Fetcher MCP Server",
    version: "1.0.0",
    endpoint: "/mcp",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
  });
});

// ================================
// MCP Transport
// ================================
const transport = new StreamableHTTPServerTransport();

await mcpServer.connect(transport);

// MCP Endpoint
app.all("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

// ================================
// Start Server
// ================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});
