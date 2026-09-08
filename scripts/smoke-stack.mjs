import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
mkdirSync(".test-output", { recursive: true });
function start(args, cwd, name, extra = {}) {
  const log = createWriteStream(resolve(".test-output", name + ".log"));
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}
const api = start(
  [resolve("apps/api/dist/server.js")],
  process.cwd(),
  "api-runtime",
);
const web = start(
  [
    resolve("apps/web/node_modules/next/dist/bin/next"),
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    "3000",
  ],
  resolve("apps/web"),
  "web-runtime",
  { NODE_ENV: "production" },
);
async function ready(url, child) {
  for (let n = 0; n < 60; n++) {
    if (child.exitCode !== null)
      throw new Error("Server exited; inspect .test-output runtime logs.");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not become ready.");
}
try {
  await Promise.all([
    ready("http://127.0.0.1:4000/api/health", api),
    ready("http://127.0.0.1:3000/login", web),
  ]);
  await import("./smoke.mjs");
} finally {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  await Promise.all(
    [api, web].map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once("exit", resolve)),
    ),
  );
}
