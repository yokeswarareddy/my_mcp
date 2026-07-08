import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// 1. Setup our core MCP Server
const mcpServer = new Server({
  name: "template-fetcher-server",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

// 2. Define the tool
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "get_template_names",
      description: "Scrapes the target website link to get updated template names.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The full website URL containing the templates" }
        },
        required: ["https://askem.ai"]
      }
    }]
  };
});

// 3. Handle the actual execution logic
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_template_names") {
    try {
      const targetUrl = request.params.arguments.url;
      const response = await axios.get(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return {
        content: [{ type: "text", text: `Success! Retrieved ${response.data.length} characters.` }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `Scraping failed: ${error.message}` }]
      };
    }
  }
});

// 4. Create Express app using the Unified Streamable HTTP transport
const app = express();
app.use(express.json()); // Essential for modern HTTP routing

const transport = new StreamableHTTPServerTransport();
await mcpServer.connect(transport);

// The new standard unifies everything onto a single endpoint!
app.all("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Modern Streamable HTTP MCP Server live on port ${PORT}!`);
});