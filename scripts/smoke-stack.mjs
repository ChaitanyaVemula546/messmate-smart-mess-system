import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

// Check the compiled single-process deployment against a configured cloud DB.
// Use test accounts in an isolated cloud database, never the laptop PGlite data.
dotenv.config({ path: resolve(".env.production.local") });
if (
  !process.env.DATABASE_URL ||
  !process.env.AUTH_SECRET ||
  !process.env.APP_URL
)
  throw new Error(
    "Configure DATABASE_URL, AUTH_SECRET and APP_URL privately in .env.production.local first.",
  );
if (
  !process.env.SMOKE_ADMIN_EMAIL ||
  !process.env.SMOKE_STUDENT_EMAIL ||
  !process.env.SMOKE_PASSWORD
)
  throw new Error(
    "Set SMOKE_ADMIN_EMAIL, SMOKE_STUDENT_EMAIL and SMOKE_PASSWORD for test accounts in the same isolated cloud database.",
  );
mkdirSync(".test-output", { recursive: true });
const log = createWriteStream(resolve(".test-output/web-runtime.log"));
const port = process.env.SMOKE_PORT || "3100";
const web = spawn(
  process.execPath,
  [
    resolve("apps/web/node_modules/next/dist/bin/next"),
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    port,
  ],
  {
    cwd: resolve("apps/web"),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
web.stdout.pipe(log);
web.stderr.pipe(log);
const localOrigin = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (web.exitCode !== null)
      throw new Error("Next.js exited; inspect .test-output/web-runtime.log.");
    try {
      if (
        (
          await fetch(localOrigin + "/login", {
            signal: AbortSignal.timeout(2000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Next.js did not become ready.");
  process.env.SMOKE_WEB_ORIGIN = localOrigin;
  process.env.SMOKE_API_ORIGIN = localOrigin;
  process.env.SMOKE_REQUEST_ORIGIN = process.env.APP_URL;
  await import("./smoke.mjs");
} finally {
  web.kill("SIGTERM");
  if (web.exitCode === null)
    await new Promise((resolve) => web.once("exit", resolve));
  log.end();
}
