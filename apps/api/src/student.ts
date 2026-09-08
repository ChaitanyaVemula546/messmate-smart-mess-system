import { Router } from "express";
import { sql } from "@messmate/database";
import { preference } from "@messmate/validation";
import { localClock, addDays } from "@messmate/shared";
import { MEALS, type HistoryRow, type Student } from "@messmate/types";
import { route, ok, user, fail, page, type Context } from "./http";
import { windows } from "./data";
import type { Security } from "./security";
export function studentRoutes(ctx: Context, sec: Security) {
  const r = Router();
  r.use(sec.requireUser, sec.roles("STUDENT"), sec.csrf);
  r.get(
    "/meals",
    route(async (req, res) => {
      const clock = localClock(ctx.now()),
        date = String(req.query.date ?? clock.date);
      if (date !== clock.date && date !== addDays(clock.date, 1))
        fail(400, "INVALID_DATE", "Choose today or tomorrow.");
      const w = await windows(ctx.db);
      const prefs = await ctx.db.query<{ meal: string; response: string }>(
        sql`SELECT meal,response FROM meal_preferences WHERE student_id=${user(res).student_id} AND date=${date}`,
      );
      const records = await ctx.db.query<{ meal: string }>(
        sql`SELECT meal FROM attendance WHERE student_id=${user(res).student_id} AND date=${date}`,
      );
      ok(res, {
        date,
        time: clock.time,
        windows: w,
        meals: MEALS.map((meal) => ({
          meal,
          response: prefs.find((p) => p.meal === meal)?.response ?? null,
          present: records.some((a) => a.meal === meal),
          closed:
            date === clock.date &&
            clock.time >= w.find((m) => m.meal === meal)!.cutoff_time,
        })),
      });
    }),
  );
  r.put(
    "/meals",
    route(async (req, res) => {
      const input = preference.parse(req.body);
      const clock = localClock(ctx.now());
      await ctx.db.transaction(async (tx) => {
        const [w] = await tx.query<{ cutoff_time: string }>(
          sql`SELECT cutoff_time FROM meal_windows WHERE meal=${input.meal} FOR SHARE`,
        );
        if (input.date < clock.date || input.date > addDays(clock.date, 1))
          fail(
            400,
            "INVALID_DATE",
            "Preferences are available for today and tomorrow.",
          );
        if (input.date === clock.date && clock.time >= w.cutoff_time)
          fail(409, "CUTOFF_PASSED", "The response deadline has passed.");
        await tx.query(
          sql`INSERT INTO meal_preferences(student_id,date,meal,response) VALUES(${user(res).student_id},${input.date},${input.meal},${input.response}) ON CONFLICT(student_id,date,meal) DO UPDATE SET response=excluded.response,updated_at=${ctx.now()}`,
        );
      });
      ok(res, { saved: true, ...input });
    }),
  );
  r.get(
    "/history",
    route(async (req, res) => {
      const p = page(req);
      const attendanceOnly = req.query.kind === "attendance";
      const items = await ctx.db.query<HistoryRow>(
        sql`SELECT coalesce(p.date,a.date)::text AS date,coalesce(p.meal,a.meal) AS meal,p.response,(a.id IS NOT NULL) AS present,a.check_in_time,a.source FROM (SELECT * FROM meal_preferences WHERE student_id=${user(res).student_id}) p FULL JOIN (SELECT * FROM attendance WHERE student_id=${user(res).student_id}) a ON a.student_id=p.student_id AND a.date=p.date AND a.meal=p.meal WHERE (${attendanceOnly}=false OR a.id IS NOT NULL) ORDER BY date DESC,meal LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      const [count] = await ctx.db.query<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM (SELECT date,meal FROM meal_preferences WHERE student_id=${user(res).student_id} AND ${attendanceOnly}=false UNION SELECT date,meal FROM attendance WHERE student_id=${user(res).student_id}) h`,
      );
      ok(res, {
        items,
        total: count.total,
        page: p.page,
        pageSize: p.pageSize,
      });
    }),
  );
  r.get(
    "/profile",
    route(async (_req, res) => {
      const [profile] = await ctx.db.query<Student>(
        sql`SELECT s.*,u.name,u.email,f.fingerprint_id FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN fingerprint_mappings f ON f.student_id=s.id WHERE s.id=${user(res).student_id}`,
      );
      ok(res, profile);
    }),
  );
  return r;
}
