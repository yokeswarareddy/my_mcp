import express from "express";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

// Parse standard incoming JSON requests
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
        // Fetch the active tenant routing mapping configuration directly
        const response = await axios.get("https://askem.ai/tenant_configuration.json", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json"
          }
        });
        
        const data = response.data;
        let templates = [];

        // Dynamic JSON Navigation: Safely grab items regardless of layout key maps
        if (data && Array.isArray(data.templates)) {
          templates = data.templates.map(t => ({ name: t.name || t.title }));
        } else if (data && data.shop && Array.isArray(data.shop.items)) {
          templates = data.shop.items.map(t => ({ name: t.name || t.title }));
        } else if (typeof data === "object") {
          // Fallback fallback: Search object trees dynamically for any arrays matching conversation objects
          const values = Object.values(data);
          const targetedArray = values.find(val => Array.isArray(val) && val.length > 0 && (val[0].name || val[0].title));
          if (targetedArray) {
            templates = targetedArray.map(t => ({ name: t.name || t.title }));
          }
        }

        // Hardcoded safety defaults if the tenant endpoint configuration only holds theme data
        if (templates.length === 0) {
          templates = [
            { name: "Ask him/her out" },
            { name: "Apology and Forgiveness" },
            { name: "Salary Negotiation" },
            { name: "Handling Workplace Conflict" }
          ];
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(templates, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Fetch dynamic payload exception:", error.message);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Failed to fetch dynamic content properties: ${error.message}` })
            }
          ],
          isError: true
        };
      }
    }
  );

  const transport = new StreamableHTTPServerTransport();

  try {
    await mcpServer.connect(transport);
    
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
