import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

// Required middleware to parse incoming JSON bodies for the MCP transport
app.use(express.json());

// 1. Root and Health Endpoints
app.get("/", (req, res) => {
  res.json({
    status: "running",
    server: "Template Fetcher MCP Server",
    version: "2.0.0",
    endpoint: "/mcp"
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// 2. Main MCP Unified Endpoint (Handles GET, POST, DELETE verbs for Streamable HTTP)
app.all("/mcp", async (req, res) => {
  // To avoid cross-client stream leaks, instantiate a new server and transport per request
  const mcpServer = new McpServer({
    name: "Template Fetcher MCP Server",
    version: "2.0.0",
  });

  // Register the get_template_names tool
  mcpServer.tool(
    "get_template_names",
    {}, // Input schema is empty since no parameters are required
    async () => {
      try {
        const response = await axios.get("https://askem.ai/shop", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        
        const $ = cheerio.load(response.data);
        const templates = [];

        $(".text-card-foreground h3").each((_, el) => {
          const name = $(el).text().trim();
          if (name) {
            templates.push({ name });
          }
        });

        // MCP tools must return content objects wrapped inside a text block
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(templates, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Scraping error:", error.message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Failed to fetch templates from the source website." })
            }
          ],
          isError: true
        };
      }
    }
  );

  // Initialize the transport in stateless mode
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  // Connect the server to the transport stream and process the current request
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    console.error("MCP Transport handling error:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }

  // Clean up references when the client closes the connection
  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });
});

// 3. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
