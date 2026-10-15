import { sql, type Database } from "@messmate/database";
import { MEALS, type Meal, type Prediction } from "@messmate/types";
import { addDays } from "@messmate/shared";
import { settings } from "./data";
export interface Forecast {
  attendance: number;
  wasteKg: number | null;
  foodKg: number | null;
  sampleCount: number;
  source: string;
}
export interface PredictionService {
  predictAttendance(date: string, meal: Meal): Promise<Forecast | null>;
  predictWaste(date: string, meal: Meal): Promise<number | null>;
  predictFoodRequirement(date: string, meal: Meal): Promise<number | null>;
}
export class DemoPredictionProvider implements PredictionService {
  constructor(private db: Database) {}
  async predictAttendance(date: string, meal: Meal) {
    // Intention responses already give expected attendance. Never substitute
    // post-meal fingerprint attendance for a pre-meal feature.
    const [intentions] = await this.db.query<{ expected: number; responses: number }>(
      sql`SELECT count(*) FILTER(WHERE response='COMING')::int AS expected,
        count(*)::int AS responses FROM meal_preferences
        WHERE date=${date} AND meal=${meal}`);
    const previous = await this.db.query<{ actual: number }>(
      sql`SELECT count(*)::int AS actual FROM attendance
        WHERE meal=${meal} AND date>=${addDays(date,-90)} AND date<${date}
        GROUP BY date ORDER BY date DESC LIMIT 28`);
    const historicalAttendance = previous.length >= 3
      ? Math.round(previous.reduce((s, v) => s + v.actual, 0) / previous.length)
      : null;
    const attendance = intentions.responses > 0
      ? intentions.expected : historicalAttendance;
    if (attendance === null) return null;
    // Only real, directly weighed staff records train this fallback.
    // Estimates and legacy sensor diagnostics are not ground truth.
    const observed = await this.db.query<{ waste: number }>(
      sql`SELECT (unserved_kg+plate_kg)::float8 AS waste
        FROM manual_waste_records
        WHERE meal=${meal} AND measurement_method='WEIGHED'
          AND date>=${addDays(date,-90)} AND date<${date}
        ORDER BY date DESC LIMIT 28`);
    const wasteKg = observed.length >= 3
      ? observed.reduce((sum, v) => sum + v.waste, 0) / observed.length
      : null;
    const s = await settings(this.db);
    return {
      attendance,
      wasteKg,
      foodKg: s.portionKg === null ? null : attendance * s.portionKg,
      sampleCount: observed.length,
      source: intentions.responses > 0
        ? "INTENTIONS_PLUS_HISTORICAL_BASELINE" : "HISTORICAL_BASELINE",
    };
  }
  async predictWaste(date: string, meal: Meal) {
    return (await this.predictAttendance(date, meal))?.wasteKg ?? null;
  }
  async predictFoodRequirement(date: string, meal: Meal) {
    return (await this.predictAttendance(date, meal))?.foodKg ?? null;
  }
}
export async function generate(
  db: Database,
  date: string,
  inputs: { holiday: boolean; specialEvent: string },
  provider: PredictionService = new DemoPredictionProvider(db),
) {
  let count = 0;
  for (const meal of MEALS) {
    const p = await provider.predictAttendance(date, meal);
    if (!p) continue;
    await db.query(
      sql`INSERT INTO predictions(date,meal,attendance,waste_kg,food_kg,source,sample_count,inputs) VALUES(${date},${meal},${p.attendance},${p.wasteKg},${p.foodKg},${p.source},${p.sampleCount},${JSON.stringify({ ...inputs, notice: "No ML accuracy claim. Attendance uses submitted intentions when available; waste uses the mean of at least three previous directly weighed manual observations. Estimated records excluded." })}::jsonb) ON CONFLICT(date,meal) DO UPDATE SET attendance=excluded.attendance,waste_kg=excluded.waste_kg,food_kg=excluded.food_kg,source=excluded.source,sample_count=excluded.sample_count,inputs=excluded.inputs,created_at=now()`,
    );
    count++;
  }
  return count;
}
export async function predictionList(db: Database, from: string, to: string) {
  return db.query<Prediction>(
    sql`SELECT p.id,p.date::text,p.meal,p.attendance,p.waste_kg,p.food_kg,p.source,p.sample_count,r.actual_attendance,r.actual_waste,abs(p.attendance-r.actual_attendance)::int AS absolute_error,CASE WHEN r.actual_attendance>0 THEN greatest(0,1-abs(p.attendance-r.actual_attendance)::float8/r.actual_attendance)*100 ELSE NULL END AS accuracy FROM predictions p LEFT JOIN prediction_results r ON r.prediction_id=p.id WHERE p.date BETWEEN ${from} AND ${to} ORDER BY p.date DESC,p.meal`,
  );
}
