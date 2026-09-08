import { connect, loadEnv } from "@messmate/database";
import { buildApp } from "./app";
loadEnv();
const production = process.env.NODE_ENV === "production";
if (
  !process.env.DATABASE_URL ||
  !process.env.AUTH_SECRET ||
  !process.env.APP_URL
)
  throw new Error(
    "DATABASE_URL, AUTH_SECRET and APP_URL are required. Run pnpm run setup for local development.",
  );
const configuredOrigin = new URL(process.env.APP_URL);
if (
  configuredOrigin.origin !== process.env.APP_URL ||
  (production && configuredOrigin.protocol !== "https:")
)
  throw new Error(
    "APP_URL must be an exact origin and use HTTPS in production.",
  );
const db = await connect(process.env.DATABASE_URL);
const app = buildApp({
  db,
  secret: process.env.AUTH_SECRET,
  origin: process.env.APP_URL,
  production,
  now: () => new Date(),
});
const server = app.listen(
  Number(process.env.API_PORT ?? 4000),
  process.env.API_HOST ?? "0.0.0.0",
  () => console.log("MessMate API is listening."),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      db.close().finally(() => process.exit(0));
    });
  });
