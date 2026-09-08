import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Router } from "express";
import { sql } from "@messmate/database";
import { security } from "./security";
import { studentRoutes } from "./student";
import { iotRoutes } from "./iot";
import { peopleRoutes } from "./admin-people";
import { dataRoutes } from "./admin-data";
import { errors, ok, route, type Context } from "./http";
export function buildApp(ctx: Context) {
  if (ctx.secret.length < 32)
    throw new Error("AUTH_SECRET must be at least 32 characters.");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: ctx.origin,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Messmate-Client"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "800kb" }));
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const sec = security(ctx);
  sec.mount(app);
  app.get(
    "/api/health",
    route(async (_req, res) => {
      try {
        await ctx.db.query(sql`SELECT 1`);
        ok(res, {
          application: "ok",
          database: "connected",
          timestamp: ctx.now(),
          version: "1.0.0",
        });
      } catch {
        res.status(503).json({
          success: false,
          error: {
            code: "DATABASE_UNAVAILABLE",
            message: "Database unavailable.",
          },
        });
      }
    }),
  );
  app.use("/api/student", studentRoutes(ctx, sec));
  app.use("/api/iot", iotRoutes(ctx, sec));
  const admin = Router();
  admin.use(sec.requireUser, sec.roles("ADMIN", "MESS_ADMIN"), sec.csrf);
  admin.use(peopleRoutes(ctx, sec));
  admin.use(dataRoutes(ctx, sec));
  app.use("/api/admin", admin);
  app.use((_req, res) =>
    res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found." },
    }),
  );
  app.use(errors);
  return app;
}
