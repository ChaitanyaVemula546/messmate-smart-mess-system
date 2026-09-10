import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import { connect, migrate, sql, type Database } from "../packages/database/src";
import { databasePoolOptions } from "../packages/database/src/config";
import { buildApp } from "../apps/api/src/app";
import { clientAddress } from "../apps/api/src/security";
import { runtimeConfig } from "../apps/api/src/runtime";
import handler, { config } from "../apps/web/pages/api/[[...path]]";

// Run the adapter through Next's real resolver so its cookie/query/response
// helpers are present, as they are in production (not only raw Node objects).
const requireWeb = createRequire(resolve("apps/web/package.json"));
const { apiResolver } = requireWeb(
  "next/dist/server/api-utils/node/api-resolver",
);

const state = vi.hoisted(() => ({
  app: undefined as ReturnType<typeof buildApp> | undefined,
}));
vi.mock("../apps/api/src/runtime", async (original) => ({
  ...(await original<typeof import("../apps/api/src/runtime")>()),
  getApp: async () => state.app!,
}));
const secret = randomBytes(40).toString("hex");
const password = randomBytes(24).toString("base64url");
const origin = "https://messmate.example.com";
const productionEnv = {
  NODE_ENV: "production",
  VERCEL: "1",
  DATABASE_URL: "postgresql://db.example.com/messmate",
  AUTH_SECRET: secret,
  APP_URL: origin,
} satisfies NodeJS.ProcessEnv;

describe("Production configuration", () => {
  it("requires secrets and a public exact HTTPS origin without echoing credentials", () => {
    expect(runtimeConfig(productionEnv).production).toBe(true);
    for (const APP_URL of [
      "http://messmate.example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://192.168.1.2",
      origin + "/",
      origin + "/path",
      "invalid",
    ])
      expect(() => runtimeConfig({ ...productionEnv, APP_URL })).toThrow(
        /APP_URL/,
      );
    expect(() =>
      runtimeConfig({ ...productionEnv, AUTH_SECRET: "short" }),
    ).toThrow(/AUTH_SECRET/);
    expect(
      runtimeConfig({
        ...productionEnv,
        NODE_ENV: "development",
        APP_URL: "http://localhost:3000",
      }).production,
    ).toBe(false);
  });
  it("uses bounded pools with verified TLS and refuses laptop databases", () => {
    const options = databasePoolOptions(
      productionEnv.DATABASE_URL + "?sslmode=require",
      productionEnv,
    );
    expect(options.max).toBe(3);
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
    expect(options.connectionString).not.toContain("sslmode");
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.3",
      "[::1]",
    ])
      expect(() =>
        databasePoolOptions(`postgresql://${host}/db`, productionEnv),
      ).toThrow(/cloud/);
    for (const sslmode of ["disable", "allow", "prefer", "no-verify"])
      expect(() =>
        databasePoolOptions(
          productionEnv.DATABASE_URL + "?sslmode=" + sslmode,
          productionEnv,
        ),
      ).toThrow(/TLS/);
    expect(() =>
      databasePoolOptions(productionEnv.DATABASE_URL, {
        ...productionEnv,
        DB_POOL_MAX: "500",
      }),
    ).toThrow(/DB_POOL_MAX/);
    expect(
      databasePoolOptions("postgresql://localhost/db", {
        NODE_ENV: "development",
      }).ssl,
    ).toBeUndefined();
  });
  it("ignores spoofed forwarding headers outside Vercel", () => {
    const req = {
      socket: { remoteAddress: "127.0.0.1" },
      headers: {
        "x-vercel-forwarded-for": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1",
      },
    } as unknown as Parameters<typeof clientAddress>[0];
    expect(clientAddress(req)).toBe("127.0.0.1");
    expect(clientAddress(req, true)).toBe("203.0.113.10");
    req.headers["x-vercel-forwarded-for"] = "invalid, 203.0.113.10";
    expect(clientAddress(req, true)).toBe("127.0.0.1");
  });
});

describe("Production Express app through the serverless adapter", () => {
  let db: Database, server: Server, base: string, cookie: string;
  beforeAll(async () => {
    // Test-only in-memory PostgreSQL engine. The app itself uses production
    // security settings; no production connection or real user data is touched.
    db = await connect("memory://");
    await migrate(db);
    await db.query(
      sql`INSERT INTO users(email,name,password_hash,role) VALUES('production@test.local','Production test',${await hash(password, 10)},'ADMIN')`,
    );
    state.app = buildApp({
      db,
      secret,
      origin,
      production: true,
      vercel: true,
      now: () => new Date(),
    });
    server = createServer((req, res) => {
      const query = Object.fromEntries(
        new URL(req.url!, "http://test.local").searchParams,
      );
      void apiResolver(
        req,
        res,
        query,
        { default: handler, config },
        {
          previewModeId: "",
          previewModeEncryptionKey: "",
          previewModeSigningKey: "",
          dev: false,
        },
        false,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  });
  afterAll(async () => {
    if (server)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    if (db) await db.close();
  });
  it("keeps health and API error routing functional", async () => {
    const health = await fetch(base + "/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      data: { database: "connected" },
    });
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect((await fetch(base + "/not-a-route")).status).toBe(404);
    expect((await fetch(base + "/admin/students")).status).toBe(401);
  });
  it("issues secure cookies and retains sessions after a new app instance", async () => {
    const response = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "production@test.local", password }),
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie")!;
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    cookie = setCookie.split(";")[0];
    expect(await response.json()).toMatchObject({
      data: { user: { role: "ADMIN" } },
    });
    state.app = buildApp({
      db,
      secret,
      origin,
      production: true,
      vercel: true,
      now: () => new Date(),
    });
    expect(
      (
        await fetch(base + "/admin/students?page=1&pageSize=1", {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(200);
  });
  it("restricts CORS and CSRF while retaining device preflights", async () => {
    const preflight = await fetch(base + "/iot/attendance", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,authorization",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
    expect(preflight.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    const response = await fetch(base + "/auth/logout", {
      method: "POST",
      headers: {
        Origin: "https://attacker.invalid",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).not.toBe(
      "https://attacker.invalid",
    );
  });
  it("preserves the hardware contract, authentication, and JSON size limit", async () => {
    for (const path of ["/iot/attendance", "/iot/waste"]) {
      expect(
        (
          await fetch(base + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: '{"fingerprintId":1}',
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(base + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{",
          })
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await fetch(base + "/iot/waste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "x".repeat(820000) }),
        })
      ).status,
    ).toBe(413);
  });
  it("retains shared login limits across instances and separates Vercel client IPs", async () => {
    const body = JSON.stringify({ email: "production@test.local", password });
    const source = "203.0.113.1";
    const { tokenHash } = await import("../apps/api/src/security");
    await db.query(
      sql`INSERT INTO rate_limits(key,count,expires_at) VALUES(${"login-source:" + tokenHash(source, secret)},60,${new Date(Date.now() + 60000)})`,
    );
    const login = (ip: string) =>
      fetch(base + "/auth/login", {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "x-vercel-forwarded-for": ip,
        },
        body,
      });
    expect((await login(source)).status).toBe(429);
    expect((await login("203.0.113.2")).status).toBe(200);
  });
});
