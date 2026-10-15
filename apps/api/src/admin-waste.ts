import { Router } from "express";
import { z } from "zod";
import { sql, type Database } from "@messmate/database";
import { manualWaste, manualWasteUpdate, meal as mealSchema } from "@messmate/validation";
import { localClock } from "@messmate/shared";
import { route, ok, fail, page, user, type Context } from "./http";
import { audit, range } from "./data";

// Keep raw legacy waste_measurements separate from staff-entered measurements.
const fields = sql`w.id,w.date::text AS date,w.meal,
  w.unserved_kg::float8 AS unserved_kg,w.plate_kg::float8 AS plate_kg,
  (w.unserved_kg+w.plate_kg)::float8 AS total_kg,
  w.measurement_method,w.remarks,w.created_by,w.updated_by,
  w.created_at,w.updated_at,creator.name AS recorded_by`;

async function fetchRecord(db: Database, id: string) {
  const [record] = await db.query(sql`
    SELECT ${fields} FROM manual_waste_records w
    JOIN users creator ON creator.id=w.created_by WHERE w.id=${id}`);
  return record ?? null;
}
const recordId = z.string().uuid();

export function manualWasteRoutes(ctx: Context) {
  const r = Router();

  r.get("/waste/manual", route(async (req, res) => {
    const { from, to } = range(req, ctx.now());
    const p = page(req);
    const meal = req.query.meal ? mealSchema.parse(req.query.meal) : "";
    const where = sql`w.date BETWEEN ${from} AND ${to} AND (${meal}='' OR w.meal=${meal})`;
    const items = await ctx.db.query(sql`
      SELECT ${fields} FROM manual_waste_records w
      JOIN users creator ON creator.id=w.created_by
      WHERE ${where} ORDER BY w.date DESC,w.meal DESC
      LIMIT ${p.pageSize} OFFSET ${p.offset}`);
    const [summary] = await ctx.db.query<{
      total: number; waste_kg: number; weighed_kg: number;
      estimated_kg: number; unserved_kg: number; plate_kg: number;
    }>(sql`SELECT count(*)::int AS total,
      coalesce(sum(w.unserved_kg+w.plate_kg),0)::float8 AS waste_kg,
      coalesce(sum(w.unserved_kg+w.plate_kg) FILTER(WHERE w.measurement_method='WEIGHED'),0)::float8 AS weighed_kg,
      coalesce(sum(w.unserved_kg+w.plate_kg) FILTER(WHERE w.measurement_method='ESTIMATED'),0)::float8 AS estimated_kg,
      coalesce(sum(w.unserved_kg),0)::float8 AS unserved_kg,
      coalesce(sum(w.plate_kg),0)::float8 AS plate_kg
      FROM manual_waste_records w WHERE ${where}`);
    ok(res, { items, ...p, ...summary });
  }));

  r.get("/waste/manual/:id", route(async (req, res) => {
    const id = recordId.parse(req.params.id);
    const record = await fetchRecord(ctx.db, id);
    if (!record) fail(404, "NOT_FOUND", "Waste record not found.");
    const revisions = await ctx.db.query(sql`
      SELECT r.id,r.before_data,r.after_data,r.changed_at,u.name AS changed_by
      FROM manual_waste_revisions r JOIN users u ON u.id=r.changed_by
      WHERE r.record_id=${id} ORDER BY r.changed_at DESC LIMIT 100`);
    ok(res, { ...record, revisions });
  }));

  r.post("/waste/manual", route(async (req, res) => {
    const input = manualWaste.parse(req.body);
    if (input.date > localClock(ctx.now()).date)
      fail(400, "INVALID_DATE", "Cannot record future waste.");
    const actor = user(res);
    const id = await ctx.db.transaction(async (tx) => {
      const [inserted] = await tx.query<{ id: string }>(sql`
        INSERT INTO manual_waste_records(
          date,meal,unserved_kg,plate_kg,measurement_method,remarks,created_by,updated_by
        ) VALUES(
          ${input.date},${input.meal},${input.unservedKg},${input.plateKg},
          ${input.measurementMethod},${input.remarks},${actor.id},${actor.id}
        ) RETURNING id`);
      const after = { ...input, totalKg: input.unservedKg + input.plateKg };
      await tx.query(sql`INSERT INTO manual_waste_revisions(record_id,changed_by,before_data,after_data)
        VALUES(${inserted.id},${actor.id},NULL,${JSON.stringify(after)}::jsonb)`);
      await audit(tx, actor, "MANUAL_WASTE_CREATED", "manual_waste", inserted.id,
        { date: input.date, meal: input.meal, method: input.measurementMethod });
      return inserted.id;
    });
    ok(res, await fetchRecord(ctx.db, id), 201);
  }));

  r.patch("/waste/manual/:id", route(async (req, res) => {
    const id = recordId.parse(req.params.id);
    const change = manualWasteUpdate.parse(req.body);
    const actor = user(res);
    await ctx.db.transaction(async (tx) => {
      const [before] = await tx.query<{
        date: string; meal: string; unserved_kg: number; plate_kg: number;
        measurement_method: string; remarks: string;
      }>(sql`SELECT date::text AS date,meal,unserved_kg::float8 AS unserved_kg,
        plate_kg::float8 AS plate_kg,measurement_method,remarks
        FROM manual_waste_records WHERE id=${id} FOR UPDATE`);
      if (!before) fail(404, "NOT_FOUND", "Waste record not found.");
      const next = {
        unservedKg: change.unservedKg ?? before.unserved_kg,
        plateKg: change.plateKg ?? before.plate_kg,
        measurementMethod: change.measurementMethod ?? before.measurement_method,
        remarks: change.remarks ?? before.remarks,
      };
      await tx.query(sql`UPDATE manual_waste_records SET
        unserved_kg=${next.unservedKg},plate_kg=${next.plateKg},
        measurement_method=${next.measurementMethod},remarks=${next.remarks},
        updated_by=${actor.id},updated_at=${ctx.now()} WHERE id=${id}`);
      await tx.query(sql`INSERT INTO manual_waste_revisions(
        record_id,changed_by,before_data,after_data
      ) VALUES(${id},${actor.id},${JSON.stringify(before)}::jsonb,
        ${JSON.stringify({ ...next, date: before.date, meal: before.meal })}::jsonb)`);
      await audit(tx, actor, "MANUAL_WASTE_UPDATED", "manual_waste", id,
        { date: before.date, meal: before.meal });
    });
    ok(res, await fetchRecord(ctx.db, id));
  }));
  return r;
}
