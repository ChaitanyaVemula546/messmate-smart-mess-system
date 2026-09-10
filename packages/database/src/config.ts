import type { PoolConfig } from "pg";

export function isLocalHostname(hostname: string) {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  return (
    (!host.includes(".") && !host.includes(":")) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "::" ||
    /^(?:0|10|127)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
    /^(?:fc|fd)[0-9a-f]{2}:|^fe80:/i.test(host)
  );
}

export function databasePoolOptions(
  value: string,
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL connection string.",
    );
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must use PostgreSQL.");
  const production = env.NODE_ENV === "production";
  if (production && isLocalHostname(url.hostname))
    throw new Error(
      "Production DATABASE_URL must point to a cloud PostgreSQL host.",
    );
  const max = Number(env.DB_POOL_MAX || (env.VERCEL === "1" ? 3 : 10));
  if (!Number.isInteger(max) || max < 1 || max > 20)
    throw new Error("DB_POOL_MAX must be an integer between 1 and 20.");
  if (production) {
    // Connection-string SSL options override PoolConfig.ssl. Normalize provider
    // sslmode=require URLs to retain strict certificate verification.
    if (
      ["disable", "allow", "prefer", "no-verify"].includes(
        url.searchParams.get("sslmode") ?? "",
      ) ||
      url.searchParams.get("ssl") === "false"
    )
      throw new Error("Production database connections require verified TLS.");
    for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) {
      if (
        ["sslcert", "sslkey", "sslrootcert"].includes(key) &&
        url.searchParams.has(key)
      )
        throw new Error(
          "Use a cloud database with a publicly trusted TLS certificate.",
        );
      url.searchParams.delete(key);
    }
  }
  return {
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
    ...(production ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
