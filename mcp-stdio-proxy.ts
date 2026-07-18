import fs from "node:fs/promises";
import { homedir } from "node:os";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  // 1. Read mcp.json to find the dynamically allocated port + agent token
  const configPath = `${homedir()}/.config/mdreadr/mcp.json`;
  let url = "http://127.0.0.1:50932/mcp"; // default fallback
  let token: string | undefined;
  try {
    const configData = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configData);
    if (config?.mcpServers?.mdreadr?.url) {
      url = config.mcpServers.mdreadr.url;
    }
    if (config?.mcpServers?.mdreadr?.token) {
      token = config.mcpServers.mdreadr.token;
    }
  } catch (_err) {
    // ignore
  }

  // Connect to the HTTP MCP Server as a Client with retries. /mcp requires the
  // agent token minted per-launch (packages/api/auth.ts) once the server
  // gates that route.
  const httpTransport = new StreamableHTTPClientTransport(url, {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });

  // Connect to Stdio immediately
  const stdioTransport = new StdioServerTransport();
  await stdioTransport.start();

  let httpStartPromise: Promise<void> | null = null;
  let processQueue: Promise<void> = Promise.resolve();

  // Forward messages from Stdio to HTTP sequentially
  stdioTransport.onmessage = (message) => {
    processQueue = processQueue.then(async () => {
      try {
        if (!httpStartPromise) {
          httpStartPromise = httpTransport.start();
        }
        await httpStartPromise;
        await httpTransport.send(message);
      } catch (e) {
        console.error("Failed to forward to HTTP:", e);
        // Return a JSON-RPC error back to stdio so the client doesn't hang forever
        const msg = message as { id?: number | string };
        if (msg.id !== undefined) {
          await stdioTransport.send({
            jsonrpc: "2.0",
            id: msg.id,
            error: {
              code: -32603,
              message: "mdreadr server is not running. Please start mdreadr and try again.",
            },
          } as unknown as Parameters<typeof stdioTransport.send>[0]);
        }
      }
    });
  };

  // Forward messages from HTTP to Stdio
  httpTransport.onmessage = async (message) => {
    try {
      await stdioTransport.send(message);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle closes without exiting immediately
  stdioTransport.onclose = () => {
    process.exit(0);
  };
  httpTransport.onclose = () => {
    // ignore
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
