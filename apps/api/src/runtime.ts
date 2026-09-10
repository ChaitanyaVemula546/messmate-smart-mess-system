import { connect, isLocalHostname } from "@messmate/database";
import { waitUntil } from "@vercel/functions";
import { buildApp } from "./app";

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === "production";
  if (!env.DATABASE_URL || !env.AUTH_SECRET || !env.APP_URL)
    throw new Error("DATABASE_URL, AUTH_SECRET and APP_URL are required.");
  if (
    env.AUTH_SECRET.length < 32 ||
    /^(YOUR_|CHANGE_|REPLACE_)/i.test(env.AUTH_SECRET)
  )
    throw new Error(
      "AUTH_SECRET must be a private random value of at least 32 characters.",
    );
  let origin: URL;
  try {
    origin = new URL(env.APP_URL);
  } catch {
    throw new Error("APP_URL must be an exact web origin.");
  }
  if (
    origin.origin !== env.APP_URL ||
    !["http:", "https:"].includes(origin.protocol) ||
    (production &&
      (origin.protocol !== "https:" || isLocalHostname(origin.hostname)))
  )
    throw new Error(
      "APP_URL must be an exact origin and a public HTTPS origin in production.",
    );
  return {
    databaseUrl: env.DATABASE_URL,
    secret: env.AUTH_SECRET,
    origin: env.APP_URL,
    production,
    vercel: env.VERCEL === "1",
  };
}

export async function createRuntime() {
  const { databaseUrl, vercel, ...config } = runtimeConfig();
  const db = await connect(databaseUrl);
  try {
    return {
      db,
      app: buildApp({
        ...config,
        db,
        now: () => new Date(),
        vercel,
        ...(vercel ? { waitUntil } : {}),
      }),
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}

// Share initialization across concurrent requests in each warm instance.
// No listener, filesystem lookup, migrations, or seeding happens on import.
let runtime: ReturnType<typeof createRuntime> | undefined;
export async function getApp() {
  runtime ??= createRuntime().catch((error: unknown) => {
    runtime = undefined;
    throw error;
  });
  return (await runtime).app;
}
