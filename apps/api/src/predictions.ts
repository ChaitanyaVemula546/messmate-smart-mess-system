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
    const history = await this.db.query<{
      actual: number;
      waste: number | null;
    }>(
      sql`SELECT count(a.id)::int AS actual,(SELECT sum(delta_kg) FROM waste_measurements w WHERE w.date=a.date AND w.meal=${meal} AND NOT w.tare)::float8 AS waste FROM attendance a WHERE a.meal=${meal} AND a.date>=${addDays(date, -90)} AND a.date<${date} GROUP BY a.date ORDER BY a.date DESC LIMIT 28`,
    );
    if (history.length < 3) return null;
    const s = await settings(this.db);
    const attendance = Math.round(
      history.reduce((n, r) => n + r.actual, 0) / history.length,
    );
    const waste = history.filter((r) => r.waste !== null);
    return {
      attendance,
      wasteKg: waste.length
        ? waste.reduce((n, r) => n + r.waste!, 0) / waste.length
        : null,
      foodKg: s.portionKg === null ? null : attendance * s.portionKg,
      sampleCount: history.length,
      source: "DEMO_BASELINE",
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
      sql`INSERT INTO predictions(date,meal,attendance,waste_kg,food_kg,source,sample_count,inputs) VALUES(${date},${meal},${p.attendance},${p.wasteKg},${p.foodKg},${p.source},${p.sampleCount},${JSON.stringify({ ...inputs, notice: "Holiday and event stored for future model; baseline uses historical mean." })}::jsonb) ON CONFLICT(date,meal) DO UPDATE SET attendance=excluded.attendance,waste_kg=excluded.waste_kg,food_kg=excluded.food_kg,source=excluded.source,sample_count=excluded.sample_count,inputs=excluded.inputs,created_at=now()`,
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
