import type { NextApiRequest, NextApiResponse } from "next";
import { getApp } from "@messmate/api/runtime";

export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const app = await getApp();
    await new Promise<void>((resolve, reject) => {
      res.once("finish", resolve);
      res.once("close", resolve);
      res.once("error", reject);
      // Express retains parsing, validation, authorization, cookies, and routing.
      app(req, res);
    });
  } catch {
    console.error(JSON.stringify({ event: "api_initialization_failed" }));
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The service is temporarily unavailable.",
        },
      });
    } else if (!res.writableEnded) res.end();
  }
}
