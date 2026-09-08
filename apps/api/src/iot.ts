import { Router } from "express";
import { randomUUID } from "node:crypto";
import { sql } from "@messmate/database";
import { fingerprint, waste } from "@messmate/validation";
import { localClock, activeMeal } from "@messmate/shared";
import type { Device } from "@messmate/types";
import { windows } from "./data";
import { route, ok, fail, type Context } from "./http";
import type { Security } from "./security";
export function iotRoutes(ctx: Context, sec: Security) {
  const r = Router();
  r.post(
    "/attendance",
    sec.device("FINGERPRINT_SCANNER"),
    route(async (req, res) => {
      const parsed = fingerprint.safeParse(req.body);
      if (!parsed.success)
        fail(
          400,
          "INVALID_FINGERPRINT_ID",
          "Fingerprint ID must be an integer from 1 to 1000.",
        );
      const id = parsed.data!.fingerprintId;
      const d = res.locals.device as Device & { token_hash: string };
      const result = await ctx.db.transaction(async (tx) => {
        const [current] = await tx.query<Device & { token_hash: string }>(
          sql`SELECT * FROM devices WHERE id=${d.id} FOR SHARE`,
        );
        if (!current || current.status !== "ACTIVE")
          fail(403, "DEVICE_DISABLED", "Device is disabled.");
        if (current.token_hash !== d.token_hash)
          fail(401, "UNAUTHORIZED_DEVICE", "Device credential was rotated.");
        const [s] = await tx.query<{
          id: string;
          student_id: string;
          name: string;
        }>(
          sql`SELECT s.id,s.student_id,u.name FROM fingerprint_mappings f JOIN students s ON s.id=f.student_id JOIN users u ON u.id=s.user_id WHERE f.fingerprint_id=${id} AND s.status='ACTIVE' AND u.status='ACTIVE' FOR SHARE OF f,s,u`,
        );
        if (!s)
          fail(
            404,
            "FINGERPRINT_NOT_REGISTERED",
            "Fingerprint is not mapped to an active student.",
          );
        const w = await tx.query<import("@messmate/types").MealWindow>(
          sql`SELECT * FROM meal_windows ORDER BY start_time FOR SHARE`,
        );
        const meal = activeMeal(w, ctx.now());
        if (!meal) fail(409, "NO_ACTIVE_MEAL", "No meal is currently active.");
        const date = localClock(ctx.now()).date;
        const rows = await tx.query(
          sql`INSERT INTO attendance(student_id,date,meal,check_in_time,fingerprint_id,source,device_id) VALUES(${s.id},${date},${meal!.meal},${ctx.now()},${id},'FINGERPRINT',${d.id}) ON CONFLICT(student_id,date,meal) DO NOTHING RETURNING id`,
        );
        return {
          status: rows.length ? "recorded" : "already_recorded",
          student: { id: s.id, studentId: s.student_id, name: s.name },
          meal: meal!.meal,
          date,
        };
      });
      res.locals.deviceResult = result.status;
      res.json({ success: true, ...result, data: result });
    }),
  );
  r.post(
    "/waste",
    sec.device("WASTE_MONITOR"),
    route(async (req, res) => {
      const input = waste.parse(req.body);
      const auth = res.locals.device as Device & { token_hash: string };
      if (input.deviceId !== auth.device_id)
        fail(
          403,
          "DEVICE_MISMATCH",
          "Payload device does not match its credential.",
        );
      const event = input.measurementId ?? randomUUID();
      const result = await ctx.db.transaction(async (tx) => {
        const [d] = await tx.query<
          Device & {
            high_water_kg: number;
            tare_session: number;
            token_hash: string;
          }
        >(sql`SELECT * FROM devices WHERE id=${auth.id} FOR UPDATE`);
        if (d.status !== "ACTIVE")
          fail(403, "DEVICE_DISABLED", "Device is disabled.");
        if (d.token_hash !== auth.token_hash)
          fail(401, "UNAUTHORIZED_DEVICE", "Device credential was rotated.");
        if (input.weightKg > d.capacity_kg)
          fail(
            400,
            "INVALID_WEIGHT",
            "Measurement exceeds configured capacity.",
          );
        const [existing] = await tx.query<{
          weight_kg: number;
          tare: boolean;
          delta_kg: number;
        }>(
          sql`SELECT weight_kg,tare,delta_kg FROM waste_measurements WHERE device_id=${d.id} AND measurement_id=${event}`,
        );
        if (existing) {
          if (
            existing.weight_kg !== input.weightKg ||
            existing.tare !== Boolean(input.tare)
          )
            fail(
              409,
              "IDEMPOTENCY_CONFLICT",
              "Measurement ID was already used for a different reading.",
            );
          return {
            status: "already_recorded",
            addedKg: existing.delta_kg,
            measurementId: event,
          };
        }
        const clock = localClock(ctx.now()),
          meal = activeMeal(await windows(tx), ctx.now());
        const delta = input.tare
          ? 0
          : Math.max(0, input.weightKg - d.high_water_kg);
        const session = d.tare_session + (input.tare ? 1 : 0);
        await tx.query(
          sql`INSERT INTO waste_measurements(device_id,measurement_id,weight_kg,delta_kg,tare,tare_session,date,meal,measured_at) VALUES(${d.id},${event},${input.weightKg},${delta},${Boolean(input.tare)},${session},${clock.date},${meal?.meal ?? null},${ctx.now()})`,
        );
        await tx.query(
          sql`UPDATE devices SET high_water_kg=${input.tare ? input.weightKg : Math.max(d.high_water_kg, input.weightKg)},tare_session=${session} WHERE id=${d.id}`,
        );
        return {
          status: "recorded",
          addedKg: delta,
          measurementId: event,
          date: clock.date,
          meal: meal?.meal ?? null,
        };
      });
      res.locals.deviceResult = result.status;
      ok(res, result);
    }),
  );
  return r;
}
