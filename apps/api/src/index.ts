import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { resolveServerAddress } from "./serverConfig.js";

loadEnv();
const app = createApp();

const { hostname, port } = resolveServerAddress(process.env);
try {
  serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`Align API listening on http://${hostname}:${port}`);
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
