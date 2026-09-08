import { Router } from "express";
import { parse } from "csv-parse/sync";
import { sql } from "@messmate/database";
import {
  manual,
  preparation,
  windows as validateWindows,
  assumptions,
  predictionInput,
  date as dateSchema,
  meal as mealSchema,
} from "@messmate/validation";
import { localClock, csv, addDays } from "@messmate/shared";
import { route, ok, fail, page, user, type Context } from "./http";
import { audit, range, dashboard, windows, settings, metrics } from "./data";
import { generate, predictionList } from "./predictions";
import type { Security } from "./security";
export function dataRoutes(ctx: Context, sec: Security) {
  const r = Router();
  r.get(
    "/dashboard",
    route(async (req, res) => {
      const { from, to } = range(req, ctx.now());
      ok(res, await dashboard(ctx, from, to));
    }),
  );
  r.get(
    "/attendance",
    route(async (req, res) => {
      const p = page(req),
        date = dateSchema.parse(req.query.date ?? localClock(ctx.now()).date),
        meal = mealSchema.parse(req.query.meal ?? "LUNCH"),
        search = "%" + String(req.query.search ?? "").slice(0, 100) + "%";
      const base = sql`FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN meal_preferences p ON p.student_id=s.id AND p.date=${date} AND p.meal=${meal} LEFT JOIN attendance a ON a.student_id=s.id AND a.date=${date} AND a.meal=${meal} LEFT JOIN fingerprint_mappings f ON f.student_id=s.id WHERE (u.name ILIKE ${search} OR s.student_id ILIKE ${search})`;
      const items = await ctx.db.query(
        sql`SELECT s.id,s.student_id,u.name,p.response,(a.id IS NOT NULL) AS present,a.check_in_time,a.source,coalesce(a.fingerprint_id,f.fingerprint_id) AS fingerprint_id ${base} ORDER BY s.student_id LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      const [summary] = await ctx.db.query(
        sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE p.response='COMING')::int AS expected,count(a.id)::int AS present,count(*) FILTER(WHERE p.response='COMING' AND a.id IS NULL)::int AS absent,count(*) FILTER(WHERE a.id IS NOT NULL AND p.response IS DISTINCT FROM 'COMING')::int AS unexpected ${base}`,
      );
      ok(res, { items, ...p, total: summary.total, summary });
    }),
  );
  r.post(
    "/attendance",
    route(async (req, res) => {
      const v = manual.parse(req.body);
      if (v.date > localClock(ctx.now()).date)
        fail(
          400,
          "INVALID_DATE",
          "Attendance cannot be recorded in the future.",
        );
      await ctx.db.transaction(async (tx) => {
        if (
          !(
            await tx.query(
              sql`SELECT id FROM students WHERE id=${v.studentId} AND status='ACTIVE' FOR SHARE`,
            )
          ).length
        )
          fail(404, "NOT_FOUND", "Active student not found.");
        const inserted = await tx.query(
          sql`INSERT INTO attendance(student_id,date,meal,source,reason,check_in_time) VALUES(${v.studentId},${v.date},${v.meal},'MANUAL',${v.reason},${ctx.now()}) ON CONFLICT(student_id,date,meal) DO NOTHING RETURNING id`,
        );
        if (!inserted.length)
          fail(409, "DUPLICATE", "Attendance already exists.");
        await audit(
          tx,
          user(res),
          "MANUAL_ATTENDANCE",
          "student",
          v.studentId,
          { date: v.date, meal: v.meal, reason: v.reason },
        );
      });
      ok(res, { recorded: true }, 201);
    }),
  );
  r.get(
    "/waste",
    route(async (req, res) => {
      const { from, to } = range(req, ctx.now()),
        p = page(req),
        meal = String(req.query.meal ?? "");
      const filter = sql`w.date BETWEEN ${from} AND ${to} AND (${meal}='' OR w.meal=${meal} OR (${meal}='UNASSIGNED' AND w.meal IS NULL))`;
      const items = await ctx.db.query(
        sql`SELECT w.id,w.date::text,w.meal,d.device_id,w.weight_kg,w.delta_kg,w.tare,w.tare_session,w.measured_at FROM waste_measurements w JOIN devices d ON d.id=w.device_id WHERE ${filter} ORDER BY measured_at DESC LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      const [n] = await ctx.db.query(
        sql`SELECT count(*)::int AS total,coalesce(sum(w.delta_kg),0)::float8 AS waste_kg,coalesce(sum(w.delta_kg) FILTER(WHERE w.meal IS NULL),0)::float8 AS unassigned_kg FROM waste_measurements w WHERE ${filter}`,
      );
      ok(res, {
        items,
        ...p,
        total: n.total,
        wasteKg: n.waste_kg,
        unassignedKg: n.unassigned_kg,
      });
    }),
  );
  r.put(
    "/preparations",
    route(async (req, res) => {
      const v = preparation.parse(req.body);
      await ctx.db.transaction(async (tx) => {
        await tx.query(
          sql`INSERT INTO food_preparations(date,meal,weight_kg,estimated_cost) VALUES(${v.date},${v.meal},${v.weightKg},${v.estimatedCost}) ON CONFLICT(date,meal) DO UPDATE SET weight_kg=excluded.weight_kg,estimated_cost=excluded.estimated_cost`,
        );
        await audit(
          tx,
          user(res),
          "PREPARATION_SAVED",
          "meal",
          v.date + ":" + v.meal,
          { weightKg: v.weightKg, estimatedCost: v.estimatedCost },
        );
      });
      ok(res, { saved: true });
    }),
  );
  r.get(
    "/settings/meals",
    route(async (_req, res) => ok(res, await windows(ctx.db))),
  );
  r.put(
    "/settings/meals",
    route(async (req, res) => {
      const v = validateWindows.parse(req.body);
      await ctx.db.transaction(async (tx) => {
        await tx.query(sql`LOCK TABLE meal_windows IN EXCLUSIVE MODE`);
        for (const m of v)
          await tx.query(
            sql`UPDATE meal_windows SET start_time=${m.start_time},end_time=${m.end_time},cutoff_time=${m.cutoff_time} WHERE meal=${m.meal}`,
          );
        await audit(tx, user(res), "MEAL_WINDOWS_UPDATED", "settings", null, {
          windows: v,
        });
      });
      ok(res, { saved: true });
    }),
  );
  r.get(
    "/settings",
    route(async (_req, res) => ok(res, await settings(ctx.db))),
  );
  r.put(
    "/settings",
    sec.roles("ADMIN"),
    route(async (req, res) => {
      const v = assumptions.parse(req.body);
      await ctx.db.transaction(async (tx) => {
        await tx.query(
          sql`UPDATE system_settings SET value=${JSON.stringify(v)}::jsonb WHERE key='assumptions'`,
        );
        await audit(tx, user(res), "ASSUMPTIONS_UPDATED", "settings", null, v);
      });
      ok(res, { saved: true });
    }),
  );
  r.get(
    "/audit-logs",
    sec.roles("ADMIN"),
    route(async (req, res) => {
      const p = page(req);
      const items = await ctx.db.query(
        sql`SELECT a.*,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      const [n] = await ctx.db.query(
        sql`SELECT count(*)::int AS total FROM audit_logs`,
      );
      ok(res, { items, ...p, total: n.total });
    }),
  );
  r.get(
    "/predictions",
    route(async (req, res) => {
      const { from, to } = range(req, ctx.now());
      ok(res, await predictionList(ctx.db, from, to));
    }),
  );
  r.post(
    "/predictions",
    route(async (req, res) => {
      const v = predictionInput.parse(req.body),
        today = localClock(ctx.now()).date;
      if (v.date < addDays(today, 1) || v.date > addDays(today, 7))
        fail(400, "INVALID_DATE", "Create forecasts for the next 1–7 days.");
      const count = await ctx.db.transaction(async (tx) => {
        const n = await generate(tx, v.date, v);
        await audit(
          tx,
          user(res),
          "DEMO_PREDICTIONS_GENERATED",
          "prediction",
          v.date,
          { count: n },
        );
        return n;
      });
      ok(res, {
        count,
        message: count
          ? "Demo baselines generated."
          : "Insufficient history: at least three observed meal dates required.",
      });
    }),
  );
  r.post(
    "/predictions/evaluate",
    route(async (_req, res) => {
      await ctx.db.transaction(async (tx) => {
        await tx.query(
          sql`INSERT INTO prediction_results(prediction_id,actual_attendance,actual_waste,evaluated_at) SELECT p.id,(SELECT count(*)::int FROM attendance a WHERE a.date=p.date AND a.meal=p.meal),(SELECT sum(delta_kg) FROM waste_measurements w WHERE w.date=p.date AND w.meal=p.meal AND NOT w.tare),${ctx.now()} FROM predictions p WHERE p.date<${localClock(ctx.now()).date} ON CONFLICT(prediction_id) DO UPDATE SET actual_attendance=excluded.actual_attendance,actual_waste=excluded.actual_waste,evaluated_at=excluded.evaluated_at`,
        );
        await audit(tx, user(res), "PREDICTIONS_EVALUATED", "prediction");
      });
      ok(res, { evaluated: true });
    }),
  );
  r.get(
    "/reports",
    route(async (req, res) => {
      const { from, to } = range(req, ctx.now());
      ok(res, { ...(await dashboard(ctx, from, to)), from, to });
    }),
  );
  r.post(
    "/import/attendance",
    sec.roles("ADMIN"),
    route(async (req, res) => {
      const text = req.body?.csv;
      if (typeof text !== "string" || text.length > 700000)
        fail(
          400,
          "INVALID_CSV",
          "CSV text is required and must be below 700 KB.",
        );
      let records: Record<string, string>[];
      try {
        records = parse(text, {
          columns: true,
          skip_empty_lines: true,
          bom: true,
          trim: true,
          max_record_size: 2000,
        }) as Record<string, string>[];
      } catch {
        fail(400, "INVALID_CSV", "CSV could not be parsed.");
      }
      if (records!.length > 5000)
        fail(400, "IMPORT_LIMIT", "Import at most 5000 rows per batch.");
      const summary = {
        processed: records!.length,
        successful: 0,
        duplicates: 0,
        failed: 0,
        errors: [] as { row: number; message: string }[],
      };
      const valid: { id: string; date: string; meal: string }[] = [];
      for (let i = 0; i < records!.length; i++) {
        const v = records![i];
        const date = dateSchema.safeParse(v.date),
          meal = mealSchema.safeParse(v.meal);
        if (
          !date.success ||
          !meal.success ||
          !["PRESENT", "ABSENT"].includes(v.attendance) ||
          v.date > localClock(ctx.now()).date
        ) {
          summary.failed++;
          summary.errors.push({
            row: i + 2,
            message: "Invalid date, meal or attendance (PRESENT/ABSENT).",
          });
          continue;
        }
        const [s] = await ctx.db.query<{ id: string }>(
          sql`SELECT id FROM students WHERE student_id=${v.studentId}`,
        );
        if (!s) {
          summary.failed++;
          summary.errors.push({ row: i + 2, message: "Unknown studentId." });
          continue;
        }
        if (v.attendance === "ABSENT") {
          summary.successful++;
          continue;
        }
        valid.push({ id: s.id, date: v.date, meal: v.meal });
      }
      await ctx.db.transaction(async (tx) => {
        for (const v of valid) {
          const rows = await tx.query(
            sql`INSERT INTO attendance(student_id,date,meal,check_in_time,source,reason) VALUES(${v.id},${v.date},${v.meal},NULL,'IMPORT','Historical CSV import; check-in time unavailable') ON CONFLICT(student_id,date,meal) DO NOTHING RETURNING id`,
          );
          if (rows.length) summary.successful++;
          else summary.duplicates++;
        }
        await audit(tx, user(res), "ATTENDANCE_IMPORTED", "attendance", null, {
          processed: summary.processed,
          successful: summary.successful,
          failed: summary.failed,
          duplicates: summary.duplicates,
        });
      });
      ok(res, summary);
    }),
  );
  r.get(
    "/export/:kind",
    route(async (req, res) => {
      const { from, to } = range(req, ctx.now());
      let rows: Record<string, unknown>[];
      let columns: string[];
      switch (req.params.kind) {
        case "attendance":
          rows = await ctx.db.query(
            sql`SELECT a.date::text,a.meal,s.student_id,u.name,a.source,a.check_in_time FROM attendance a JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id WHERE a.date BETWEEN ${from} AND ${to} ORDER BY a.date,a.meal,s.student_id LIMIT 50001`,
          );
          columns = [
            "date",
            "meal",
            "student_id",
            "name",
            "source",
            "check_in_time",
          ];
          break;
        case "students":
          rows = await ctx.db.query(
            sql`SELECT s.student_id,u.name,u.email,s.registration_number,s.hostel,s.room_number,s.status,f.fingerprint_id FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN fingerprint_mappings f ON f.student_id=s.id ORDER BY s.student_id LIMIT 50001`,
          );
          columns = [
            "student_id",
            "name",
            "email",
            "registration_number",
            "hostel",
            "room_number",
            "status",
            "fingerprint_id",
          ];
          break;
        case "waste":
          rows = await ctx.db.query(
            sql`SELECT w.date::text,w.meal,d.device_id,w.weight_kg,w.delta_kg,w.tare,w.measured_at FROM waste_measurements w JOIN devices d ON d.id=w.device_id WHERE w.date BETWEEN ${from} AND ${to} ORDER BY w.measured_at LIMIT 50001`,
          );
          columns = [
            "date",
            "meal",
            "device_id",
            "weight_kg",
            "delta_kg",
            "tare",
            "measured_at",
          ];
          break;
        case "predictions":
          rows = (await predictionList(ctx.db, from, to)) as unknown as Record<
            string,
            unknown
          >[];
          columns = [
            "date",
            "meal",
            "attendance",
            "waste_kg",
            "food_kg",
            "source",
            "sample_count",
            "actual_attendance",
            "absolute_error",
          ];
          break;
        case "reports":
          rows = (await metrics(ctx.db, from, to)) as unknown as Record<
            string,
            unknown
          >[];
          columns = [
            "date",
            "meal",
            "expected",
            "actual",
            "waste_kg",
            "has_waste",
            "prepared_kg",
            "cost",
          ];
          break;
        default:
          fail(404, "NOT_FOUND", "Export does not exist.");
      }
      if (rows!.length > 50000)
        fail(
          413,
          "EXPORT_LIMIT",
          "Narrow the range to export at most 50000 rows.",
        );
      res
        .type("text/csv")
        .attachment(`messmate-${req.params.kind}.csv`)
        .send(csv(rows!, columns!));
    }),
  );
  return r;
}
