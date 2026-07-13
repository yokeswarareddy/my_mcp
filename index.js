import express from "express";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

app.use(express.json());

function createMcpServer() {
  const mcpServer = new McpServer({
    name: "askem-trend-analyzer",
    version: "1.0.0"
  });

  mcpServer.tool(
    "get_template_names",
    "Extracts conversation template titles directly from the application bundle object structures",
    {}, 
    async () => {
      try {
        // Fetch the bundle file directly with decompression headers to prevent binary garbling
        const response = await axios.get("https://askem.ai/assets/index-VcUb2ZvD.js", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/javascript,*/*",
            "Accept-Encoding": "gzip, deflate, br" 
          },
          responseType: "text", 
          timeout: 10000 
        });

        const jsContent = response.data;
        
        if (!jsContent || typeof jsContent !== "string") {
          throw new Error("Target bundle resource returned non-parseable payload formats");
        }

        const uniqueTitles = new Set();

        // Clean, structural Regex: Looks specifically for object properties formatted as -> title: "Value"
        const titlePattern = /title\s*:\s*["']([^"']+)["']/g;
        let match;

        while ((match = titlePattern.exec(jsContent)) !== null) {
          const foundTitle = match[1].trim();
          
          // Basic sanity filter to ignore framework boilerplate variables (no hardcoded template names!)
          if (
            foundTitle && 
            foundTitle.length > 2 && 
            foundTitle.length < 100 && // Templates won't be massive paragraphs
            !foundTitle.includes("/") && 
            !["document", "window", "element", "object", "string", "true", "false", "undefined"].includes(foundTitle.toLowerCase())
          ) {
            uniqueTitles.add(foundTitle);
          }
        }

        // Map the dynamically scraped titles to the required JSON array format { name: "..." }
        const templates = Array.from(uniqueTitles).map(title => ({ name: title }));

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
              text: JSON.stringify({ error: `Failed to extract template properties safely: ${error.message}` })
            }
          ],
          isError: true
        };
      }
    }
  );

  return mcpServer;
}

app.get("/", (req, res) => {
  res.json({ status: "healthy", protocol: "MCP Streamable HTTP" });
});

app.all("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ 
    sessionIdGenerator: undefined 
  });

  const mcpServer = createMcpServer();

  res.on("close", () => {
    transport.close().catch(err => console.error("Error closing transport:", err.message));
  });

  try {
    await mcpServer.connect(transport);

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
  console.log(`ASKEM MCP Server listening on port ${PORT}`);
});
