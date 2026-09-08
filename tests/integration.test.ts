import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import type { Server } from "node:http";
import { connect, migrate, sql, type Database } from "../packages/database/src";
import { buildApp } from "../apps/api/src/app";
import { tokenHash } from "../apps/api/src/security";
let db: Database, server: Server, base: string;
const secret = randomBytes(40).toString("hex"),
  password = randomBytes(18).toString("base64url"),
  scan = randomBytes(32).toString("base64url"),
  waste = randomBytes(32).toString("base64url");
let clock = new Date("2026-09-06T06:45:00Z");
let studentId: string,
  otherId: string,
  scannerId: string,
  binId: string,
  adminCookie: string,
  studentCookie: string,
  managerCookie: string,
  mobileToken: string;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  auth?: string,
  mobile = false,
) {
  const headers: Record<string, string> = { Origin: "http://localhost:3000" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth)
    headers[auth.startsWith("messmate_") ? "Cookie" : "Authorization"] =
      auth.startsWith("messmate_") ? auth : `Bearer ${auth}`;
  if (mobile) headers["X-Messmate-Client"] = "mobile";
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: response.headers.get("content-type")?.includes("json")
      ? JSON.parse(text)
      : text,
    headers: response.headers,
  };
}
beforeAll(async () => {
  db = await connect("memory://");
  await migrate(db);
  await migrate(db);
  const ph = await hash(password, 10);
  const ids: Record<string, string> = {};
  for (const [email, role] of [
    ["admin@test.local", "ADMIN"],
    ["manager@test.local", "MESS_ADMIN"],
    ["student@test.local", "STUDENT"],
    ["other@test.local", "STUDENT"],
  ]) {
    const [u] = await db.query<{ id: string }>(
      sql`INSERT INTO users(email,name,password_hash,role) VALUES(${email},${role},${ph},${role}) RETURNING id`,
    );
    ids[email] = u.id;
  }
  for (const [email, id] of [
    ["student@test.local", "MM1"],
    ["other@test.local", "MM2"],
  ]) {
    const [s] = await db.query<{ id: string }>(
      sql`INSERT INTO students(user_id,student_id,registration_number,hostel,room_number) VALUES(${ids[email]},${id},${id},'Hostel','101') RETURNING id`,
    );
    if (id === "MM1") studentId = s.id;
    else otherId = s.id;
  }
  await db.query(
    sql`INSERT INTO fingerprint_mappings(student_id,fingerprint_id) VALUES(${studentId},1)`,
  );
  [scannerId, binId] = await Promise.all(
    [
      ["SCANNER_01", "FINGERPRINT_SCANNER", scan],
      ["WASTE_BIN_01", "WASTE_MONITOR", waste],
    ].map(
      async ([id, type, token]) =>
        (
          await db.query<{ id: string }>(
            sql`INSERT INTO devices(device_id,name,type,token_hash) VALUES(${id},${id},${type},${tokenHash(token, secret)}) RETURNING id`,
          )
        )[0].id,
    ),
  );
  const app = buildApp({
    db,
    secret,
    origin: "http://localhost:3000",
    production: false,
    now: () => clock,
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  for (const [email, key] of [
    ["admin@test.local", "admin"],
    ["manager@test.local", "manager"],
    ["student@test.local", "student"],
  ]) {
    const r = await request("/auth/login", "POST", { email, password });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    if (key === "admin") adminCookie = cookie;
    else if (key === "manager") managerCookie = cookie;
    else studentCookie = cookie;
  }
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (db) await db.close();
});
describe("Shared API software integration", () => {
  it("connects health to database", async () =>
    expect((await request("/health")).body.data.database).toBe("connected"));
  it("protects operational APIs and role boundaries", async () => {
    expect((await request("/admin/students")).status).toBe(401);
    expect(
      (await request("/admin/students", "GET", undefined, studentCookie))
        .status,
    ).toBe(403);
    expect(
      (await request("/admin/audit-logs", "GET", undefined, managerCookie))
        .status,
    ).toBe(403);
  });
  it("uses safe web cookies and rejects bad passwords", async () => {
    const r = await request("/auth/login", "POST", {
      email: "other@test.local",
      password,
    });
    expect(r.headers.get("set-cookie")).toContain("HttpOnly");
    expect(r.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(
      (
        await request("/auth/login", "POST", {
          email: "other@test.local",
          password: "incorrect",
        })
      ).status,
    ).toBe(401);
  });
  it("rejects cross-origin browser mutation", async () => {
    const r = await fetch(base + "/student/meals", {
      method: "PUT",
      headers: {
        Origin: "https://attacker.invalid",
        Cookie: studentCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-09-07",
        meal: "LUNCH",
        response: "COMING",
      }),
    });
    expect(r.status).toBe(403);
  });
  it("shares mobile and web identity without putting bearer in web login", async () => {
    const web = await request("/auth/login", "POST", {
      email: "student@test.local",
      password,
    });
    expect(web.body.data.token).toBeUndefined();
    const mobile = await request(
      "/auth/login",
      "POST",
      { email: "student@test.local", password },
      undefined,
      true,
    );
    mobileToken = mobile.body.data.token;
    expect(mobileToken).toBeTruthy();
    expect(mobile.headers.get("set-cookie")).toBeNull();
    expect(
      (await request("/auth/session", "GET", undefined, mobileToken)).body.data
        .student_id,
    ).toBe(studentId);
  });
  it("upserts preferences and synchronizes mobile writes to web", async () => {
    const payload = { date: "2026-09-07", meal: "LUNCH", response: "COMING" };
    expect(
      (await request("/student/meals", "PUT", payload, mobileToken)).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/student/meals",
          "PUT",
          { ...payload, response: "NOT_COMING" },
          studentCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/student/meals?date=2026-09-07",
          "GET",
          undefined,
          mobileToken,
        )
      ).body.data.meals.find((m: { meal: string }) => m.meal === "LUNCH")
        .response,
    ).toBe("NOT_COMING");
    const [n] = await db.query<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM meal_preferences WHERE student_id=${studentId}`,
    );
    expect(n.n).toBe(1);
  });
  it("enforces cutoffs and own-data validation", async () => {
    expect(
      (
        await request(
          "/student/meals",
          "PUT",
          { date: "2026-09-06", meal: "LUNCH", response: "COMING" },
          studentCookie,
        )
      ).body.error.code,
    ).toBe("CUTOFF_PASSED");
    expect(
      (
        await request(
          "/student/meals",
          "PUT",
          {
            date: "2026-09-07",
            meal: "LUNCH",
            response: "COMING",
            studentId: otherId,
          },
          studentCookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (await request("/student/profile", "GET", undefined, studentCookie)).body
        .data.id,
    ).toBe(studentId);
  });
  it("validates scanner authentication and IDs", async () => {
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 1 })).status,
    ).toBe(401);
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 1 }, waste))
        .status,
    ).toBe(403);
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 0 }, scan))
        .body.error.code,
    ).toBe("INVALID_FINGERPRINT_ID");
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 999 }, scan))
        .body.error.code,
    ).toBe("FINGERPRINT_NOT_REGISTERED");
  });
  it("records fingerprint attendance exactly once under concurrent scans", async () => {
    const rs = await Promise.all(
      Array.from({ length: 8 }, () =>
        request("/iot/attendance", "POST", { fingerprintId: 1 }, scan),
      ),
    );
    expect(rs.filter((r) => r.body.status === "recorded")).toHaveLength(1);
    expect(rs.filter((r) => r.body.status === "already_recorded")).toHaveLength(
      7,
    );
    expect(rs[0].body.student.studentId).toBe("MM1");
    const [n] = await db.query<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM attendance WHERE student_id=${studentId} AND date='2026-09-06'`,
    );
    expect(n.n).toBe(1);
  });
  it("enforces no-active-meal and disabled devices", async () => {
    clock = new Date("2026-09-06T10:00:00Z");
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 1 }, scan))
        .body.error.code,
    ).toBe("NO_ACTIVE_MEAL");
    clock = new Date("2026-09-06T06:45:00Z");
    await db.query(
      sql`UPDATE devices SET status='DISABLED' WHERE id=${scannerId}`,
    );
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 1 }, scan))
        .body.error.code,
    ).toBe("DEVICE_DISABLED");
    await db.query(
      sql`UPDATE devices SET status='ACTIVE' WHERE id=${scannerId}`,
    );
  });
  it("rejects duplicate fingerprint assignment without changing old mapping", async () => {
    const r = await request(
      "/admin/fingerprints",
      "PUT",
      { studentId: otherId, fingerprintId: 1 },
      adminCookie,
    );
    expect(r.status).toBe(409);
    expect(
      await db.query(
        sql`SELECT * FROM fingerprint_mappings WHERE student_id=${otherId}`,
      ),
    ).toHaveLength(0);
  });
  it("validates waste authentication, capacity and payloads", async () => {
    for (const weightKg of [-1, 21])
      expect(
        (
          await request(
            "/iot/waste",
            "POST",
            { deviceId: "WASTE_BIN_01", weightKg },
            waste,
          )
        ).status,
      ).toBe(400);
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "UNKNOWN", weightKg: 1 },
          waste,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "WASTE_BIN_01", weightKg: "bad" },
          waste,
        )
      ).status,
    ).toBe(400);
  });
  it("handles snapshots, idempotent retry, noise and tare", async () => {
    const id = randomUUID();
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "WASTE_BIN_01", weightKg: 3.42, measurementId: id },
          waste,
        )
      ).body.data.addedKg,
    ).toBe(3.42);
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "WASTE_BIN_01", weightKg: 3.42, measurementId: id },
          waste,
        )
      ).body.data.status,
    ).toBe("already_recorded");
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "WASTE_BIN_01", weightKg: 3.5, measurementId: id },
          waste,
        )
      ).status,
    ).toBe(409);
    for (const weightKg of [3.42, 3, 3.42])
      expect(
        (
          await request(
            "/iot/waste",
            "POST",
            { deviceId: "WASTE_BIN_01", weightKg },
            waste,
          )
        ).body.data.addedKg,
      ).toBe(0);
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "WASTE_BIN_01", weightKg: 0, tare: true },
          waste,
        )
      ).body.data.addedKg,
    ).toBe(0);
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "WASTE_BIN_01", weightKg: 1 },
          waste,
        )
      ).body.data.addedKg,
    ).toBe(1);
    const [n] = await db.query<{ total: number }>(
      sql`SELECT sum(delta_kg)::float8 AS total FROM waste_measurements WHERE device_id=${binId}`,
    );
    expect(n.total).toBeCloseTo(4.42);
  });
  it("uses stored waste in dashboard and safe undefined assumptions", async () => {
    const r = await request(
      "/admin/dashboard?date=2026-09-06",
      "GET",
      undefined,
      adminCookie,
    );
    expect(r.status).toBe(200);
    expect(r.body.data.totals.actual).toBe(1);
    expect(r.body.data.totals.wasteKg).toBeCloseTo(4.42);
    expect(r.body.data.totals.savedMoney).toBeNull();
  });
  it("protects assumptions and audit logs; responses omit hashes", async () => {
    const r = await request("/admin/students", "GET", undefined, adminCookie);
    expect(JSON.stringify(r.body)).not.toContain("password_hash");
    const d = await request("/admin/devices", "GET", undefined, adminCookie);
    expect(JSON.stringify(d.body)).not.toContain("token_hash");
    expect(
      (await request("/admin/settings", "PUT", {}, managerCookie)).status,
    ).toBe(403);
  });
  it("imports history with row errors and duplicates, rejecting student access", async () => {
    const csv =
      "date,meal,studentId,attendance\n2026-09-05,LUNCH,MM1,PRESENT\n2026-09-05,LUNCH,MM1,PRESENT\n2026-02-30,LUNCH,MM1,PRESENT\n2026-09-05,LUNCH,UNKNOWN,PRESENT";
    expect(
      (
        await request(
          "/admin/import/attendance",
          "POST",
          { csv },
          studentCookie,
        )
      ).status,
    ).toBe(403);
    const r = await request(
      "/admin/import/attendance",
      "POST",
      { csv },
      adminCookie,
    );
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      processed: 4,
      successful: 1,
      duplicates: 1,
      failed: 2,
    });
    expect(
      (
        await request(
          "/admin/export/attendance?from=2026-09-05&to=2026-09-06",
          "GET",
          undefined,
          adminCookie,
        )
      ).headers.get("content-type"),
    ).toContain("text/csv");
  });
  it("stores audited manual attendance and rejects duplicates", async () => {
    const v = {
      studentId: otherId,
      date: "2026-09-06",
      meal: "LUNCH",
      reason: "Sensor unavailable",
    };
    expect(
      (await request("/admin/attendance", "POST", v, adminCookie)).status,
    ).toBe(201);
    expect(
      (await request("/admin/attendance", "POST", v, adminCookie)).status,
    ).toBe(409);
    const r = await request("/admin/audit-logs", "GET", undefined, adminCookie);
    expect(
      r.body.data.items.some(
        (a: { action: string }) => a.action === "MANUAL_ATTENDANCE",
      ),
    ).toBe(true);
  });
  it("authenticates native requests without an Origin and closes header bypasses", async () => {
    const native = await fetch(base + "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Messmate-Client": "mobile",
      },
      body: JSON.stringify({ email: "other@test.local", password }),
    });
    expect(native.status).toBe(200);
    const body = (await native.json()) as { data: { token: string } };
    expect(
      (await request("/auth/session", "GET", undefined, body.data.token))
        .status,
    ).toBe(200);
    const bypass = await fetch(base + "/student/meals", {
      method: "PUT",
      headers: {
        Cookie: studentCookie,
        Authorization: "Bearer invalid",
        Origin: "https://attacker.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: "2026-09-07",
        meal: "DINNER",
        response: "COMING",
      }),
    });
    // Authentication rejects the malformed header before the CSRF middleware.
    expect(bypass.status).toBe(401);
    expect(
      (
        await fetch(base + "/auth/session", {
          headers: { Cookie: studentCookie, Authorization: "Bearer invalid" },
        })
      ).status,
    ).toBe(401);
  });
  it("creates a student and revokes access on deactivation", async () => {
    const profile = {
      studentId: "MM3",
      registrationNumber: "REG3",
      name: "Test Student",
      hostel: "A",
      roomNumber: "102",
      email: "created@test.local",
      status: "ACTIVE",
    };
    const created = await request(
      "/admin/students",
      "POST",
      { ...profile, password },
      managerCookie,
    );
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const login = await request(
      "/auth/login",
      "POST",
      { email: profile.email, password },
      undefined,
      true,
    );
    expect(login.status).toBe(200);
    expect(
      (
        await request(
          "/admin/fingerprints",
          "PUT",
          { studentId: id, fingerprintId: 3 },
          managerCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/admin/students/" + id,
          "PUT",
          { ...profile, status: "INACTIVE" },
          managerCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("/auth/session", "GET", undefined, login.body.data.token))
        .status,
    ).toBe(401);
    expect(
      (await request("/iot/attendance", "POST", { fingerprintId: 3 }, scan))
        .body.error.code,
    ).toBe("FINGERPRINT_NOT_REGISTERED");
    expect(
      (await request("/auth/login", "POST", { email: profile.email, password }))
        .status,
    ).toBe(401);
  });
  it("provisions and rotates device credentials and rejects disabled waste ingestion", async () => {
    const created = await request(
      "/admin/devices",
      "POST",
      {
        deviceId: "WASTE_BIN_02",
        name: "Second bin",
        type: "WASTE_MONITOR",
        capacityKg: 5,
      },
      managerCookie,
    );
    expect(created.status).toBe(201);
    const { id, token } = created.body.data;
    const rotated = await request(
      "/admin/devices/" + id,
      "PATCH",
      { rotate: true },
      managerCookie,
    );
    expect(rotated.status).toBe(200);
    const reading = { deviceId: "WASTE_BIN_02", weightKg: 1 };
    expect((await request("/iot/waste", "POST", reading, token)).status).toBe(
      401,
    );
    expect(
      (await request("/admin/devices/" + id, "PATCH", {}, managerCookie))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/admin/devices/" + id,
          "PATCH",
          { status: "DISABLED" },
          managerCookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("/iot/waste", "POST", reading, rotated.body.data.token))
        .body.error.code,
    ).toBe("DEVICE_DISABLED");
    expect(
      (
        await request(
          "/iot/waste",
          "POST",
          { deviceId: "UNKNOWN", weightKg: 1 },
          randomBytes(32).toString("base64url"),
        )
      ).status,
    ).toBe(401);
    const malformed = await fetch(base + "/iot/waste", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + waste,
        "Content-Type": "application/json",
      },
      body: '{"weightKg":',
    });
    expect(malformed.status).toBe(400);
  });
  it("retains out-of-window waste separately from meal analytics", async () => {
    clock = new Date("2026-09-06T10:00:00Z");
    try {
      const result = await request(
        "/iot/waste",
        "POST",
        { deviceId: "WASTE_BIN_01", weightKg: 1.5 },
        waste,
      );
      expect(result.body.data.meal).toBeNull();
      expect(result.body.data.addedKg).toBeCloseTo(0.5);
      const list = await request(
        "/admin/waste?date=2026-09-06&meal=UNASSIGNED",
        "GET",
        undefined,
        adminCookie,
      );
      expect(list.body.data.unassignedKg).toBeCloseTo(0.5);
    } finally {
      clock = new Date("2026-09-06T06:45:00Z");
    }
  });
  it("persists preparations and explicit assumptions used by reports", async () => {
    expect(
      (
        await request(
          "/admin/preparations",
          "PUT",
          {
            date: "2026-09-06",
            meal: "LUNCH",
            weightKg: 10,
            estimatedCost: 100,
          },
          managerCookie,
        )
      ).status,
    ).toBe(200);
    const settings = {
      costPerKg: 10,
      baselineWastePerStudent: 3,
      co2PerKg: 2,
      waterLitresPerKg: 10,
      portionKg: 0.5,
      onlineThresholdMinutes: 5,
    };
    expect(
      (await request("/admin/settings", "PUT", settings, adminCookie)).status,
    ).toBe(200);
    const report = await request(
      "/admin/reports?date=2026-09-06",
      "GET",
      undefined,
      adminCookie,
    );
    expect(report.status).toBe(200);
    expect(report.body.data.totals.preparedKg).toBe(10);
    expect(report.body.data.totals.savedMoney).toBeCloseTo(15.8);
    expect(
      (
        await request(
          "/admin/reports?from=2025-01-01&to=2026-09-06",
          "GET",
          undefined,
          adminCookie,
        )
      ).status,
    ).toBe(400);
  });
  it("generates labelled baselines and keeps unmeasured evaluation waste unknown", async () => {
    const imported = await request(
      "/admin/import/attendance",
      "POST",
      {
        csv: "date,meal,studentId,attendance\n2026-09-03,BREAKFAST,MM2,PRESENT\n2026-09-04,BREAKFAST,MM2,PRESENT\n2026-09-05,BREAKFAST,MM2,PRESENT",
      },
      adminCookie,
    );
    expect(imported.body.data.successful).toBe(3);
    expect(
      (
        await request(
          "/admin/predictions",
          "POST",
          { date: "2026-09-07" },
          managerCookie,
        )
      ).body.data.count,
    ).toBe(1);
    const result = await request(
      "/admin/predictions?date=2026-09-07",
      "GET",
      undefined,
      adminCookie,
    );
    expect(result.body.data[0]).toMatchObject({
      source: "DEMO_BASELINE",
      sample_count: 3,
      attendance: 1,
      food_kg: 0.5,
      waste_kg: null,
    });
    clock = new Date("2026-09-08T06:45:00Z");
    try {
      expect(
        (await request("/admin/predictions/evaluate", "POST", {}, adminCookie))
          .status,
      ).toBe(200);
      const evaluated = await request(
        "/admin/predictions?date=2026-09-07",
        "GET",
        undefined,
        adminCookie,
      );
      expect(evaluated.body.data[0].actual_waste).toBeNull();
    } finally {
      clock = new Date("2026-09-06T06:45:00Z");
    }
    const [importedTime] = await db.query<{ check_in_time: Date | null }>(
      sql`SELECT check_in_time FROM attendance WHERE student_id=${otherId} AND date='2026-09-03'`,
    );
    expect(importedTime.check_in_time).toBeNull();
  });
  it("expires sessions and logs out only requested session", async () => {
    expect(
      (await request("/auth/logout", "POST", {}, mobileToken, true)).status,
    ).toBe(200);
    expect(
      (await request("/auth/session", "GET", undefined, mobileToken)).status,
    ).toBe(401);
    expect(
      (await request("/auth/session", "GET", undefined, studentCookie)).status,
    ).toBe(200);
    clock = new Date("2026-09-15T06:45Z");
    expect(
      (await request("/auth/session", "GET", undefined, studentCookie)).status,
    ).toBe(401);
  });
});
