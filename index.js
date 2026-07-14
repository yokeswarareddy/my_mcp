import express from "express";
import fs from "fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

app.use(express.json());

function createMcpServer() {
  const mcpServer = new McpServer({
    name: "askem-template-server",
    version: "1.0.0",
  });

  mcpServer.tool(
    "get_template_names",
    "Returns the latest ASKEM conversation templates from templates.json",
    {},
    async () => {
      try {
        // Read the JSON file
        const file = await fs.readFile("./templates.json", "utf8");

        // Parse it
        const templates = JSON.parse(file);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(templates, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Failed to load templates:", error);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Unable to load templates.json",
                details: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return mcpServer;
}

app.get("/", (req, res) => {
  res.json({
    status: "healthy",
    protocol: "MCP Streamable HTTP",
  });
});

app.all("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const mcpServer = createMcpServer();

  res.on("close", () => {
    transport
      .close()
      .catch((err) => console.error("Transport close error:", err));
  });

  try {
    await mcpServer.connect(transport);

    if (req.body && Object.keys(req.body).length > 0) {
      await transport.handleRequest(req, res, req.body);
    } else {
      await transport.handleRequest(req, res);
    }
  } catch (error) {
    console.error("MCP Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal MCP Server Error",
      });
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 ASKEM MCP Server running on port ${PORT}`);
});
