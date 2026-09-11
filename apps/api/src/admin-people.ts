import { Router } from "express";
import { hash } from "bcryptjs";
import { sql } from "@messmate/database";
import {
  student,
  mapping,
  device,
  deviceUpdate,
  adminUser,
} from "@messmate/validation";
import type { Student, FingerprintInventoryRow } from "@messmate/types";
import { route, ok, fail, user, page, type Context } from "./http";
import { audit, deviceList } from "./data";
import { newToken, tokenHash, type Security } from "./security";
export function peopleRoutes(ctx: Context, sec: Security) {
  const r = Router();
  r.get(
    "/fingerprint-inventory",
    route(async (req, res) => {
      const p = page(req);
      const items = await ctx.db.query<FingerprintInventoryRow>(sql`
        SELECT sf.id,sf.device_id,d.name AS device_name,d.device_id AS device_code,
          sf.fingerprint_id,sf.present,sf.first_seen,sf.last_seen,
          s.id AS student_id,s.student_id AS student_code,u.name
        FROM sensor_fingerprints sf JOIN devices d ON d.id=sf.device_id
        LEFT JOIN fingerprint_mappings f ON f.fingerprint_id=sf.fingerprint_id
        LEFT JOIN students s ON s.id=f.student_id
        LEFT JOIN users u ON u.id=s.user_id
        ORDER BY sf.present DESC,d.name,d.id,sf.fingerprint_id
        LIMIT ${p.pageSize} OFFSET ${p.offset}`);
      const [count] = await ctx.db.query<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM sensor_fingerprints`,
      );
      ok(res, {
        items: items.map((item) => ({
          ...item,
          first_seen: new Date(item.first_seen).toISOString(),
          last_seen: new Date(item.last_seen).toISOString(),
        })),
        total: count.total,
        page: p.page,
        pageSize: p.pageSize,
      });
    }),
  );
  r.get(
    "/students",
    route(async (req, res) => {
      const p = page(req),
        search = "%" + String(req.query.search ?? "").slice(0, 100) + "%",
        status = String(req.query.status ?? "");
      const filter = sql`(u.name ILIKE ${search} OR s.student_id ILIKE ${search} OR u.email ILIKE ${search}) AND (${status}='' OR s.status=${status})`;
      const [count] = await ctx.db.query<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM students s JOIN users u ON u.id=s.user_id WHERE ${filter}`,
      );
      const items = await ctx.db.query<Student>(
        sql`SELECT s.*,u.name,u.email,f.fingerprint_id FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN fingerprint_mappings f ON f.student_id=s.id WHERE ${filter} ORDER BY s.student_id LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      ok(res, {
        items,
        total: count.total,
        page: p.page,
        pageSize: p.pageSize,
      });
    }),
  );
  r.post(
    "/students",
    route(async (req, res) => {
      const v = student.parse(req.body);
      if (!v.password)
        fail(
          400,
          "PASSWORD_REQUIRED",
          "A password of at least 12 characters is required.",
        );
      const passwordHash = await hash(v.password!, 12);
      const result = await ctx.db.transaction(async (tx) => {
        const [u] = await tx.query<{ id: string }>(
          sql`INSERT INTO users(email,name,password_hash,role,status) VALUES(${v.email},${v.name},${passwordHash},'STUDENT',${v.status}) RETURNING id`,
        );
        const [s] = await tx.query<{ id: string }>(
          sql`INSERT INTO students(user_id,student_id,registration_number,hostel,room_number,phone,status) VALUES(${u.id},${v.studentId},${v.registrationNumber},${v.hostel},${v.roomNumber},${v.phone ?? null},${v.status}) RETURNING id`,
        );
        await audit(tx, user(res), "STUDENT_CREATED", "student", s.id);
        return s;
      });
      ok(res, result, 201);
    }),
  );
  r.put(
    "/students/:id",
    route(async (req, res) => {
      const v = student.parse(req.body);
      if (v.password)
        fail(
          400,
          "INVALID_REQUEST",
          "Password changes are not part of profile edits.",
        );
      await ctx.db.transaction(async (tx) => {
        const [s] = await tx.query<{ user_id: string }>(
          sql`UPDATE students SET student_id=${v.studentId},registration_number=${v.registrationNumber},hostel=${v.hostel},room_number=${v.roomNumber},phone=${v.phone ?? null},status=${v.status} WHERE id=${req.params.id} RETURNING user_id`,
        );
        if (!s) fail(404, "NOT_FOUND", "Student not found.");
        await tx.query(
          sql`UPDATE users SET email=${v.email},name=${v.name},status=${v.status},updated_at=${ctx.now()} WHERE id=${s.user_id}`,
        );
        if (v.status === "INACTIVE")
          await tx.query(sql`DELETE FROM sessions WHERE user_id=${s.user_id}`);
        await audit(
          tx,
          user(res),
          "STUDENT_UPDATED",
          "student",
          req.params.id,
          { status: v.status },
        );
      });
      ok(res, { updated: true });
    }),
  );
  r.get(
    "/students/:id/history",
    route(async (req, res) => {
      const p = page(req);
      const items = await ctx.db.query(
        sql`SELECT coalesce(p.date,a.date)::text AS date,coalesce(p.meal,a.meal) AS meal,p.response,(a.id IS NOT NULL) AS present,a.check_in_time,a.source FROM (SELECT * FROM meal_preferences WHERE student_id=${req.params.id}) p FULL JOIN (SELECT * FROM attendance WHERE student_id=${req.params.id}) a ON a.date=p.date AND a.meal=p.meal ORDER BY date DESC,meal LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      const [n] = await ctx.db.query<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM (SELECT date,meal FROM meal_preferences WHERE student_id=${req.params.id} UNION SELECT date,meal FROM attendance WHERE student_id=${req.params.id}) h`,
      );
      ok(res, { items, ...p, total: n.total });
    }),
  );
  r.get(
    "/fingerprints",
    route(async (req, res) => {
      const p = page(req),
        search = "%" + String(req.query.search ?? "").slice(0, 100) + "%",
        mapped = String(req.query.mapped ?? "");
      const filter = sql`(s.student_id ILIKE ${search} OR u.name ILIKE ${search} OR f.fingerprint_id::text ILIKE ${search}) AND (${mapped}='' OR (${mapped}='yes' AND f.id IS NOT NULL) OR (${mapped}='no' AND f.id IS NULL))`;
      const items = await ctx.db.query(
        sql`SELECT s.id AS student_uuid,s.student_id,u.name,f.fingerprint_id,(SELECT max(check_in_time) FROM attendance a WHERE a.student_id=s.id) AS last_attendance FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN fingerprint_mappings f ON f.student_id=s.id WHERE ${filter} ORDER BY s.student_id LIMIT ${p.pageSize} OFFSET ${p.offset}`,
      );
      const [n] = await ctx.db.query<{ total: number }>(
        sql`SELECT count(*)::int AS total FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN fingerprint_mappings f ON f.student_id=s.id WHERE ${filter}`,
      );
      ok(res, { items, ...p, total: n.total });
    }),
  );
  r.put(
    "/fingerprints",
    route(async (req, res) => {
      const v = mapping.parse(req.body);
      await ctx.db.transaction(async (tx) => {
        const [s] = await tx.query(
          sql`SELECT id FROM students WHERE id=${v.studentId} AND status='ACTIVE' FOR UPDATE`,
        );
        if (!s) fail(404, "NOT_FOUND", "Active student not found.");
        await tx.query(
          sql`INSERT INTO fingerprint_mappings(student_id,fingerprint_id) VALUES(${v.studentId},${v.fingerprintId}) ON CONFLICT(student_id) DO UPDATE SET fingerprint_id=excluded.fingerprint_id,created_at=${ctx.now()}`,
        );
        await audit(
          tx,
          user(res),
          "FINGERPRINT_ASSIGNED",
          "student",
          v.studentId,
          { fingerprintId: v.fingerprintId },
        );
      });
      ok(res, { assigned: true });
    }),
  );
  r.delete(
    "/fingerprints/:studentId",
    route(async (req, res) => {
      await ctx.db.transaction(async (tx) => {
        const result = await tx.query(
          sql`DELETE FROM fingerprint_mappings WHERE student_id=${req.params.studentId} RETURNING id`,
        );
        if (!result.length) fail(404, "NOT_FOUND", "Mapping not found.");
        await audit(
          tx,
          user(res),
          "FINGERPRINT_REMOVED",
          "student",
          req.params.studentId,
        );
      });
      ok(res, { removed: true });
    }),
  );
  r.get(
    "/devices",
    route(async (_req, res) => ok(res, await deviceList(ctx))),
  );
  r.post(
    "/devices",
    route(async (req, res) => {
      const v = device.parse(req.body),
        token = newToken();
      const result = await ctx.db.transaction(async (tx) => {
        const [d] = await tx.query<{ id: string }>(
          sql`INSERT INTO devices(device_id,name,type,token_hash,capacity_kg,firmware_version) VALUES(${v.deviceId},${v.name},${v.type},${tokenHash(token, ctx.secret)},${v.capacityKg},${v.firmwareVersion ?? null}) RETURNING id`,
        );
        await audit(tx, user(res), "DEVICE_CREATED", "device", d.id);
        return d;
      });
      res.setHeader("Cache-Control", "no-store");
      ok(
        res,
        {
          ...result,
          token,
          notice:
            "Copy once into the physical device. It will not be shown again.",
        },
        201,
      );
    }),
  );
  r.patch(
    "/devices/:id",
    route(async (req, res) => {
      const { status, rotate } = deviceUpdate.parse(req.body);
      const token = rotate ? newToken() : null;
      await ctx.db.transaction(async (tx) => {
        const rows = await tx.query(
          sql`UPDATE devices SET status=coalesce(${status ?? null}::text,status),token_hash=coalesce(${token ? tokenHash(token, ctx.secret) : null}::text,token_hash) WHERE id=${req.params.id} RETURNING id`,
        );
        if (!rows.length) fail(404, "NOT_FOUND", "Device not found.");
        await audit(tx, user(res), "DEVICE_UPDATED", "device", req.params.id, {
          status: status ?? null,
          rotated: Boolean(token),
        });
      });
      ok(res, { updated: true, ...(token ? { token } : {}) });
    }),
  );
  r.post(
    "/administrators",
    sec.roles("ADMIN"),
    route(async (req, res) => {
      const v = adminUser.parse(req.body),
        passwordHash = await hash(v.password, 12);
      await ctx.db.transaction(async (tx) => {
        const [u] = await tx.query<{ id: string }>(
          sql`INSERT INTO users(email,name,password_hash,role) VALUES(${v.email.toLowerCase()},${v.name},${passwordHash},${v.role}) RETURNING id`,
        );
        await audit(tx, user(res), "ADMINISTRATOR_CREATED", "user", u.id, {
          role: v.role,
        });
      });
      ok(res, { created: true }, 201);
    }),
  );
  return r;
}
