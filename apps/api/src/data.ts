import { sql, type Database } from "@messmate/database";
import { localClock, addDays, validDate, summarize } from "@messmate/shared";
import type {
  MealWindow,
  Settings,
  MetricRow,
  Device,
  User,
} from "@messmate/types";
import { fail, type Context } from "./http";
import type { Request } from "express";
export const windows = (db: Database) =>
  db.query<MealWindow>(sql`SELECT * FROM meal_windows ORDER BY start_time`);
export async function settings(db: Database) {
  return (
    await db.query<{ value: Settings }>(
      sql`SELECT value FROM system_settings WHERE key='assumptions'`,
    )
  )[0].value;
}
export async function audit(
  db: Database,
  u: User,
  action: string,
  entity: string,
  id: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  await db.query(
    sql`INSERT INTO audit_logs(actor_id,actor_role,action,entity,entity_id,metadata) VALUES(${u.id},${u.role},${action},${entity},${id},${JSON.stringify(metadata)}::jsonb)`,
  );
}
export function range(req: Request, now: Date) {
  const today = localClock(now).date;
  const from = String(req.query.from ?? req.query.date ?? addDays(today, -6)),
    to = String(req.query.to ?? req.query.date ?? today);
  if (
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    Date.parse(to) - Date.parse(from) > 366 * 86400000
  )
    fail(400, "INVALID_RANGE", "Choose a valid range of at most 367 days.");
  return { from, to };
}
export async function metrics(db: Database, from: string, to: string) {
  const rows = await db.query<MetricRow>(
    sql`WITH days AS (SELECT generate_series(${from}::date,${to}::date,'1 day')::date AS date), e AS (SELECT date,meal,count(*)::int AS expected FROM meal_preferences WHERE response='COMING' AND date BETWEEN ${from} AND ${to} GROUP BY date,meal),a AS (SELECT date,meal,count(*)::int AS actual FROM attendance WHERE date BETWEEN ${from} AND ${to} GROUP BY date,meal),w AS (SELECT date,meal,sum(unserved_kg+plate_kg) AS waste_kg,count(*)::int AS samples,max(measurement_method) AS method FROM manual_waste_records WHERE date BETWEEN ${from} AND ${to} GROUP BY date,meal) SELECT d.date::text,m.meal,coalesce(e.expected,0)::int AS expected,coalesce(a.actual,0)::int AS actual,coalesce(w.waste_kg,0)::float8 AS waste_kg,(coalesce(w.samples,0)>0) AS has_waste,w.method AS waste_method,p.weight_kg AS prepared_kg,p.estimated_cost AS cost,pr.attendance AS predicted_attendance,pr.waste_kg AS predicted_waste FROM days d CROSS JOIN meal_windows m LEFT JOIN e ON e.date=d.date AND e.meal=m.meal LEFT JOIN a ON a.date=d.date AND a.meal=m.meal LEFT JOIN w ON w.date=d.date AND w.meal=m.meal LEFT JOIN food_preparations p ON p.date=d.date AND p.meal=m.meal LEFT JOIN predictions pr ON pr.date=d.date AND pr.meal=m.meal ORDER BY d.date,m.start_time`,
  );
  return rows;
}
export async function deviceList(ctx: Context) {
  const s = await settings(ctx.db);
  const since = new Date(
    ctx.now().getTime() - s.onlineThresholdMinutes * 60000,
  );
  return ctx.db.query<Device>(
    sql`SELECT id,device_id,name,type,status,last_seen,firmware_version,last_result,capacity_kg,(status='ACTIVE' AND last_seen>${since}) IS TRUE AS online FROM devices ORDER BY name`,
  );
}
export async function dashboard(ctx: Context, from: string, to: string) {
  const clock = localClock(ctx.now());
  const [rows, s, w, devices, today] = await Promise.all([
    metrics(ctx.db, from, to),
    settings(ctx.db),
    windows(ctx.db),
    deviceList(ctx),
    metrics(ctx.db, clock.date, clock.date),
  ]);
  return {
    ...clock,
    currentMeal:
      w.find((m) => clock.time >= m.start_time && clock.time < m.end_time) ??
      null,
    windows: w,
    rows,
    totals: summarize(rows, s),
    devices,
    settings: s,
    today,
  };
}
