import express from "express";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

// Required to parse standard incoming JSON requests
app.use(express.json());

// Factory pattern function to build a fresh, secure server instance context per request lifecycle
function createMcpServer() {
  const mcpServer = new McpServer({
    name: "askem-trend-analyzer",
    version: "1.0.0"
  });

  // Register your tool inside the safe execution domain boundary
  mcpServer.tool(
    "get_template_names",
    "Fetches active conversation template names directly from production client-side code assets",
    {}, 
    async () => {
      try {
        const response = await axios.get("https://askem.ai/assets/index-VcUb2ZvD.js", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*"
          },
          timeout: 10000 
        });

        const jsContent = response.data;
        const uniqueNames = new Set();
        const namePattern = /name\s*:\s*["']([^"']+)["']/g;
        let match;

        while ((match = namePattern.exec(jsContent)) !== null) {
          const foundName = match[1].trim();
          
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

  return mcpServer;
}

// Standard health checking route entry point
app.get("/", (req, res) => {
  res.json({ status: "healthy", protocol: "MCP Streamable HTTP" });
});

// Fixed Core MCP endpoint route handling requests statelessly
app.all("/mcp", async (req, res) => {
  // 1. Instantiating isolated transport explicitly setting session generators to undefined for stateless APIs
  const transport = new StreamableHTTPServerTransport({ 
    sessionIdGenerator: undefined 
  });

  // 2. Generate a clean, single-use server instance mapping context safely
  const mcpServer = createMcpServer();

  // Automatically dispose and close out connection pointers safely when the request socket terminates
  res.on("close", () => {
    transport.close().catch(err => console.error("Error closing transport:", err.message));
  });

  try {
    // Connect the isolated server context instance to the current short-lived transport safely
    await mcpServer.connect(transport);

    // Forward the payload parameters down safely to the transport handler logic
    if (req.body && Object.keys(req.body).length > 0) {
      await transport.handleRequest(req, res, req.body);
    } else {
      await transport.handleRequest(req, res);
    }
  } catch (error) {
    console.error("Transport communication execution fault:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP engine routing fault" });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ASKEM MCP Server successfully mounted and listening on port ${PORT}`);
});
