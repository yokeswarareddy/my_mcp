import express from "express";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

// Required to parse standard incoming JSON requests from your workflow agent or pipeline
app.use(express.json());

// Initialize the formal MCP Server Instance instance
const mcpServer = new McpServer({
  name: "askem-trend-analyzer",
  version: "1.0.0"
});

// Register the tool with the server instance
mcpServer.tool(
  "get_template_names",
  "Fetches active conversation template names directly from production client-side code assets",
  {}, // No input arguments needed as the asset target path is static
  async () => {
    try {
      // 1. Fetch the primary frontend production JavaScript asset bundle directly
      const response = await axios.get("https://askem.ai/assets/index-VcUb2ZvD.js", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*"
        },
        timeout: 10000 // 10-second timeout guard
      });

      const jsContent = response.data;
      const uniqueNames = new Set();

      // 2. Regular Expression targeting the template string key patterns inside the compiled bundle
      const namePattern = /name\s*:\s*["']([^"']+)["']/g;
      let match;

      while ((match = namePattern.exec(jsContent)) !== null) {
        const foundName = match[1].trim();
        
        // Filter out framework route keys, paths, and generic asset markers
        if (
          foundName && 
          foundName.length > 2 && 
          !foundName.includes("/") && 
          !foundName.includes(".") &&
          !["shop", "home", "index", "assets", "app", "error", "loading", "main", "root"].includes(foundName.toLowerCase())
        ) {
          uniqueNames.add(foundName);
        }
      }

      // Map unique sets to array JSON object payload structural array
      const templates = Array.from(uniqueNames).map(name => ({ name }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(templates)
          }
        ]
      };

    } catch (error) {
      console.error("Asset extraction pipeline exception:", error.message);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Failed to extract production asset structures: ${error.message}` })
          }
        ],
        isError: true
      };
    }
  }
);

// Standard health checking route entry point
app.get("/", (req, res) => {
  res.json({ status: "healthy", protocol: "MCP Streamable HTTP" });
});

// The core execution endpoint called by your n8n workflow or agent engine
app.all("/mcp", async (req, res) => {
  // Create an isolated transport handler context window per incoming network lifecycle call
  const transport = new StreamableHTTPServerTransport();

  try {
    // Bind the active server runtime config maps directly to the ephemeral transport lifecycle
    await mcpServer.connect(transport);

    // CRITICAL FIX: Forward the pre-parsed JSON body explicitly to the transport
    if (req.body && Object.keys(req.body).length > 0) {
      await transport.handleRequest(req, res, req.body);
    } else {
      await transport.handleRequest(req, res);
    }
  } catch (error) {
    console.error("Transport stream communication error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP engine routing fault" });
    }
  }
});

// Listen on environment variables port, fallback to port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ASKEM MCP Server successfully mounted and listening on port ${PORT}`);
});
