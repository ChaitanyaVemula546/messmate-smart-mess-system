import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodError } from "zod";
import type { Database } from "@messmate/database";
import type { User } from "@messmate/types";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (status: number, code: string, message: string): never => {
  throw new HttpError(status, code, message);
};
export const route =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });
export function user(res: Response): User {
  return res.locals.user as User;
}
export function page(req: Request) {
  const p = Number(req.query.page ?? 1),
    size = Number(req.query.pageSize ?? 20);
  if (
    !Number.isInteger(p) ||
    p < 1 ||
    p > 100000 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    fail(400, "VALIDATION_ERROR", "Invalid pagination");
  return { page: p, pageSize: size, offset: (p - 1) * size };
}
export function databaseError(err: unknown) {
  let e = err as { code?: string; cause?: unknown };
  for (let i = 0; i < 4; i++) {
    if (e.code) return e.code;
    if (!e.cause) break;
    e = e.cause as typeof e;
  }
  return undefined;
}
export function errors(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.issues.map((i) => i.message).join("; "),
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }
  const code = databaseError(err);
  if (code === "23505") {
    res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE",
        message: "That identifier is already assigned.",
      },
    });
    return;
  }
  if (["23503", "22P02", "22007", "22008", "23514"].includes(code ?? "")) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid record or reference.",
      },
    });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_REQUEST", message: "Malformed JSON body." },
    });
    return;
  }
  if ((err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request exceeds the size limit.",
      },
    });
    return;
  }
  console.error(
    JSON.stringify({ event: "request_failed", code: code ?? "INTERNAL_ERROR" }),
  );
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
    },
  });
}
export interface Context {
  db: Database;
  secret: string;
  origin: string;
  production: boolean;
  now: () => Date;
  vercel?: boolean;
  waitUntil?: (promise: Promise<unknown>) => void;
}
