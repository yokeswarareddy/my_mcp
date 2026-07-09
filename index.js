import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

// Required to parse standard incoming JSON requests
app.use(express.json());

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

// Main MCP Unified Endpoint
app.all("/mcp", async (req, res) => {
  const mcpServer = new McpServer({
    name: "Template Fetcher MCP Server",
    version: "2.0.0",
  });

  // Register tool
  mcpServer.tool(
    "get_template_names",
    {}, 
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(templates, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Failed to scrape templates: ${error.message}` })
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create the server transport instance
  const transport = new StreamableHTTPServerTransport();

  try {
    await mcpServer.connect(transport);
    
    // CRITICAL FIX: Explicitly forward the parsed body to the transport 
    // if express.json() has already consumed the stream
    if (req.body && Object.keys(req.body).length > 0) {
      await transport.handleRequest(req, res, req.body);
    } else {
      await transport.handleRequest(req, res);
    }
  } catch (err) {
    console.error("MCP Handling Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP Transport Error" });
    }
  }

  res.on("close", () => {
    transport.close();
    mcpServer.close();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
