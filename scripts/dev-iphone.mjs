#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  createApiCommand,
  createLaunchEnvironments,
  createMobileCommandArgs,
  selectLanAddress,
} from "./iphone-utils.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const useDevClient = process.argv.includes("--dev-client");
const port = Number(process.env.PORT?.trim() || "8788");

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error("PORT must be an integer from 1 through 65535.");
  process.exit(1);
}

let address;
try {
  address = selectLanAddress(networkInterfaces());
} catch {
  console.error("No private LAN IPv4 address was found. Connect this Mac and iPhone to the same Wi-Fi network, then try again.");
  process.exit(1);
}

const token = randomBytes(24).toString("base64url");
const { apiEnv, mobileEnv, apiUrl } = createLaunchEnvironments(process.env, {
  address,
  port,
  token,
});

console.log("\nAlign iPhone development loop");
console.log(`API: ${apiUrl}`);
console.log(`Client: ${useDevClient ? "development build" : "Expo Go"}`);
console.log("Keep this Mac and iPhone on the same Wi-Fi network. Scan the QR code Expo prints below.\n");

const apiCommand = createApiCommand(repoRoot);
const api = spawn(apiCommand.command, apiCommand.args, {
  cwd: apiCommand.cwd,
  env: apiEnv,
  stdio: "inherit",
});
const mobile = spawn("npm", createMobileCommandArgs(useDevClient), {
  cwd: repoRoot,
  env: mobileEnv,
  stdio: "inherit",
});

const children = [api, mobile];
let stopping = false;

function stop(signal = "SIGTERM", exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(`Unable to start development process: ${error.message}`);
    stop("SIGTERM", 1);
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    if (signal === "SIGINT") stop("SIGINT", 0);
    else stop("SIGTERM", code ?? 1);
  });
}

process.on("SIGINT", () => stop("SIGINT", 0));
process.on("SIGTERM", () => stop("SIGTERM", 0));
