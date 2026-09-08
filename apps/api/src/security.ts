import { createHmac, randomBytes } from "node:crypto";
import { compare, hashSync } from "bcryptjs";
import type { Request, RequestHandler, Express } from "express";
import { sql } from "@messmate/database";
import type { User, Role, Device } from "@messmate/types";
import { login } from "@messmate/validation";
import { route, ok, fail, user, type Context } from "./http";
export const tokenHash = (token: string, secret: string) =>
  createHmac("sha256", secret).update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const cookieName = "messmate_session";
export function sessionToken(req: Request) {
  const bearer = req.headers.authorization?.match(
    /^Bearer ([A-Za-z0-9_-]{40,100})$/,
  )?.[1];
  if (req.headers.authorization) return bearer ?? null;
  return (
    bearer ??
    (typeof req.cookies?.[cookieName] === "string"
      ? (req.cookies[cookieName] as string)
      : null)
  );
}
export function security(ctx: Context) {
  const dummyHash = hashSync(randomBytes(24).toString("hex"), 12);
  const requireUser: RequestHandler = (req, res, next) => {
    Promise.resolve(
      (async () => {
        const token = sessionToken(req);
        if (!token) fail(401, "UNAUTHORIZED", "Sign in to continue.");
        const [u] = await ctx.db.query<User>(
          sql`SELECT u.id,u.email,u.role,u.name,s.id AS student_id FROM sessions se JOIN users u ON u.id=se.user_id LEFT JOIN students s ON s.user_id=u.id WHERE se.token_hash=${tokenHash(token!, ctx.secret)} AND se.expires_at>${ctx.now()} AND u.status='ACTIVE' AND (s.id IS NULL OR s.status='ACTIVE')`,
        );
        if (!u) fail(401, "SESSION_EXPIRED", "Your session expired.");
        res.locals.user = u;
      })(),
    ).then(() => next(), next);
  };
  const roleGuard =
    (...allowed: Role[]): RequestHandler =>
    (_req, res, next) => {
      try {
        if (!allowed.includes(user(res).role))
          fail(403, "FORBIDDEN", "Your role cannot perform this action.");
        next();
      } catch (e) {
        next(e);
      }
    };
  const csrf: RequestHandler = (req, _res, next) => {
    try {
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        !(
          /^Bearer [A-Za-z0-9_-]{40,100}$/.test(
            req.headers.authorization ?? "",
          ) && !req.headers.cookie
        )
      ) {
        if (
          req.headers.origin !== ctx.origin &&
          !(
            req.headers.origin === undefined &&
            req.headers["x-messmate-client"] === "mobile" &&
            !req.headers.cookie
          )
        )
          fail(403, "CSRF_REJECTED", "Request origin is not allowed.");
      }
      next();
    } catch (e) {
      next(e);
    }
  };
  const device =
    (type: Device["type"]): RequestHandler =>
    (req, res, next) => {
      Promise.resolve(
        (async () => {
          const token = req.headers.authorization?.match(
            /^Bearer ([A-Za-z0-9_-]{40,100})$/,
          )?.[1];
          if (!token)
            fail(401, "UNAUTHORIZED_DEVICE", "Device authentication required.");
          const [d] = await ctx.db.query<
            Device & {
              token_hash: string;
              high_water_kg: number;
              tare_session: number;
            }
          >(
            sql`SELECT * FROM devices WHERE token_hash=${tokenHash(token!, ctx.secret)}`,
          );
          if (!d)
            fail(401, "UNAUTHORIZED_DEVICE", "Invalid device credential.");
          if (d.status === "DISABLED")
            fail(403, "DEVICE_DISABLED", "Device is disabled.");
          if (d.type !== type)
            fail(
              403,
              "DEVICE_TYPE_MISMATCH",
              "Device cannot use this endpoint.",
            );
          await limit("device:" + d.id, 120, 60);
          res.locals.device = d;
          await ctx.db.query(
            sql`UPDATE devices SET last_seen=${ctx.now()},last_result='authenticated' WHERE id=${d.id}`,
          );
          res.on("finish", () => {
            const result = res.locals.deviceResult as string | undefined;
            ctx.db
              .query(
                sql`UPDATE devices SET last_result=${result ?? String(res.statusCode)} WHERE id=${d.id}`,
              )
              .catch(() => {});
          });
        })(),
      ).then(() => next(), next);
    };
  async function limit(key: string, max: number, seconds: number) {
    const now = ctx.now(),
      expiry = new Date(now.getTime() + seconds * 1000);
    const [r] = await ctx.db.query<{ count: number }>(
      sql`INSERT INTO rate_limits(key,count,expires_at) VALUES(${key},1,${expiry}) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=${now} THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<=${now} THEN ${expiry} ELSE rate_limits.expires_at END RETURNING count`,
    );
    if (r.count > max)
      fail(429, "RATE_LIMITED", "Too many requests. Try again later.");
  }
  function mount(app: Express) {
    app.post(
      "/api/auth/login",
      csrf,
      route(async (req, res) => {
        const input = login.parse(req.body);
        await limit(
          "login-source:" +
            tokenHash(req.socket.remoteAddress ?? "unknown", ctx.secret),
          60,
          60,
        );
        await limit("login:" + tokenHash(input.email, ctx.secret), 10, 900);
        const [u] = await ctx.db.query<
          User & { password_hash: string; status: string }
        >(
          sql`SELECT u.id,u.email,u.role,u.name,u.password_hash,u.status,s.id AS student_id FROM users u LEFT JOIN students s ON s.user_id=u.id WHERE u.email=${input.email}`,
        );
        const valid = await compare(
          input.password,
          u?.password_hash ?? dummyHash,
        );
        if (!u || !valid || u.status !== "ACTIVE")
          fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        const token = newToken();
        const expiresAt = new Date(ctx.now().getTime() + 7 * 86400000);
        await ctx.db.query(
          sql`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(${u.id},${tokenHash(token, ctx.secret)},${expiresAt})`,
        );
        const profile: User = {
          id: u.id,
          email: u.email,
          role: u.role,
          name: u.name,
          student_id: u.student_id,
        };
        const mobile = req.headers["x-messmate-client"] === "mobile";
        if (!mobile)
          res.cookie(cookieName, token, {
            httpOnly: true,
            secure: ctx.production,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 86400000,
          });
        ok(res, { user: profile, ...(mobile ? { token } : {}), expiresAt });
      }),
    );
    app.get("/api/auth/session", requireUser, (_req, res) =>
      ok(res, user(res)),
    );
    app.post(
      "/api/auth/logout",
      csrf,
      route(async (req, res) => {
        const token = sessionToken(req);
        if (token)
          await ctx.db.query(
            sql`DELETE FROM sessions WHERE token_hash=${tokenHash(token, ctx.secret)}`,
          );
        res.clearCookie(cookieName, {
          httpOnly: true,
          secure: ctx.production,
          sameSite: "lax",
          path: "/",
        });
        ok(res, { loggedOut: true });
      }),
    );
  }
  return { requireUser, roles: roleGuard, csrf, device, mount, limit };
}
export type Security = ReturnType<typeof security>;
