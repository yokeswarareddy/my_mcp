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
    "Extracts conversation template names from application bundle scripts",
    {}, 
    async () => {
      try {
        // Fetch the bundle directly since the file is valid and accessible
        const response = await axios.get("https://askem.ai/assets/index-VcUb2ZvD.js", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*"
          },
          timeout: 10000 
        });

        const jsContent = response.data;
        const uniqueNames = new Set();

        // High-coverage broad regex: captures any text inside quotes to find text fragments
        const stringPattern = /["']([^"']+)["']/g;
        let match;

        // Exact match targets we know belong to your template features
        const targetPhrases = [
          "ask him", "ask her", "out", "apology", "forgiveness", 
          "salary", "negotiation", "workplace", "conflict"
        ];

        while ((match = stringPattern.exec(jsContent)) !== null) {
          const cleanStr = match[1].trim();
          
          // Safety filters to exclude styling tags, code syntax, or bundle errors
          if (
            cleanStr.length > 5 && 
            cleanStr.length < 50 && 
            !cleanStr.includes("/") && 
            !cleanStr.includes("{") && 
            !cleanStr.includes("<")
          ) {
            // Check if this string contains any of our core conversational phrases
            const isMatch = targetPhrases.some(phrase => 
              cleanStr.toLowerCase().includes(phrase)
            );

            if (isMatch) {
              uniqueNames.add(cleanStr);
            }
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
        console.error("Asset processing pipeline exception:", error.message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Failed to harvest template structures: ${error.message}` })
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
