import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/* ==========================================================
   MCP SERVER
========================================================== */

const mcpServer = new Server(
  {
    name: "template-fetcher-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/* ==========================================================
   EXPRESS APP
========================================================== */

const app = express();

app.use(express.json());

/* ==========================================================
   HEALTH ROUTES
========================================================== */

app.get("/", (req, res) => {
  res.json({
    status: "running",
    server: "Template Fetcher MCP Server",
    version: "2.0.0",
    endpoint: "/mcp",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
  });
});

/* ==========================================================
   TOOL LIST
========================================================== */

mcpServer.setRequestHandler(
  ListToolsRequestSchema,
  async () => ({
    tools: [
      {
        name: "get_template_names",

        description:
          "Fetches the latest ASKEM templates from the live website and returns their names.",

        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  })
);

/* ==========================================================
   SCRAPE ASKEM SHOP
========================================================== */

const SHOP_URL = "https://askem.ai/shop";

async function fetchTemplates() {
  const response = await axios.get(SHOP_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const $ = cheerio.load(response.data);

  const templates = [];
  const seen = new Set();

  $(".text-card-foreground").each((_, card) => {
    const name = $(card).find("h3").first().text().trim();

    if (name && !seen.has(name)) {
      seen.add(name);

      templates.push({
        name,
      });
    }
  });

  templates.sort((a, b) => a.name.localeCompare(b.name));

  return templates;
}

/* ==========================================================
   TOOL EXECUTION
========================================================== */

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
      const templates = await fetchTemplates();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(templates, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(error);

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to fetch templates: ${error.message}`,
          },
        ],
      };
    }
  }
);

/* ==========================================================
   TRANSPORT
========================================================== */

const transport = new StreamableHTTPServerTransport();

await mcpServer.connect(transport);

/* ==========================================================
   MCP ENDPOINT
========================================================== */

app.all("/mcp", async (req, res) => {
  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP Error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
      });
    }
  }
});

/* ==========================================================
   START SERVER
========================================================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("");
  console.log("====================================");
  console.log("🚀 Template Fetcher MCP Server");
  console.log("====================================");
  console.log(`Version : 2.0.0`);
  console.log(`Port    : ${PORT}`);
  console.log(`MCP     : /mcp`);
  console.log("====================================");
});
