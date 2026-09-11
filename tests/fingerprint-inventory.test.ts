import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { connect, migrate, sql, type Database } from "../packages/database/src";
import { buildApp } from "../apps/api/src/app";
import { tokenHash } from "../apps/api/src/security";
import type { FingerprintInventoryRow } from "../packages/types/src";

let db: Database, server: Server, base: string;
let scannerId: string, secondScannerId: string, studentId: string;
let adminCookie: string, studentCookie: string, managerCookie: string;
let clock = new Date("2026-09-11T05:00:00Z");
let changeBeforeTransaction: "rotate" | "disable" | undefined;
const secret = randomBytes(40).toString("hex");
const scannerToken = randomBytes(32).toString("base64url");
const secondScannerToken = randomBytes(32).toString("base64url");
const wasteToken = randomBytes(32).toString("base64url");

async function request(
  path: string,
  method = "GET",
  body?: unknown,
  auth?: string,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(auth?.startsWith("messmate_session=")
        ? { Cookie: auth }
        : auth
          ? { Authorization: `Bearer ${auth}` }
          : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: JSON.parse(await response.text()) };
}
const sync = (fingerprintIds: number[], token = scannerToken) =>
  request("/iot/fingerprints", "POST", { fingerprintIds }, token);
const inventory = () =>
  request("/admin/fingerprint-inventory", "GET", undefined, adminCookie);

beforeAll(async () => {
  // All tests use isolated in-memory PostgreSQL, never runtime environment URLs.
  db = await connect("memory://");
  await migrate(db);
  await migrate(db);
  for (const role of ["ADMIN", "MESS_ADMIN", "STUDENT"]) {
    const [user] = await db.query<{ id: string }>(sql`
      INSERT INTO users(email,name,password_hash,role)
      VALUES(${role.toLowerCase() + "@inventory.test"},${role === "STUDENT" ? "Inventory Student" : role},'unused-test-password-hash',${role})
      RETURNING id`);
    const token = randomBytes(32).toString("base64url");
    await db.query(sql`INSERT INTO sessions(user_id,token_hash,expires_at)
      VALUES(${user.id},${tokenHash(token, secret)},'2026-10-01T00:00:00Z')`);
    const cookie = "messmate_session=" + token;
    if (role === "ADMIN") adminCookie = cookie;
    else if (role === "MESS_ADMIN") managerCookie = cookie;
    else {
      studentCookie = cookie;
      const [student] = await db.query<{ id: string }>(sql`
        INSERT INTO students(user_id,student_id,registration_number,hostel,room_number)
        VALUES(${user.id},'INV-STUDENT','INV-REG','Test hostel','101') RETURNING id`);
      studentId = student.id;
      await db.query(
        sql`INSERT INTO fingerprint_mappings(student_id,fingerprint_id) VALUES(${studentId},11)`,
      );
    }
  }
  for (const [code, type, token] of [
    ["INV_SCANNER", "FINGERPRINT_SCANNER", scannerToken],
    ["INV_SCANNER_2", "FINGERPRINT_SCANNER", secondScannerToken],
    ["INV_BIN", "WASTE_MONITOR", wasteToken],
  ]) {
    const [device] = await db.query<{ id: string }>(sql`
      INSERT INTO devices(device_id,name,type,token_hash)
      VALUES(${code},${code},${type},${tokenHash(token, secret)}) RETURNING id`);
    if (token === scannerToken) scannerId = device.id;
    if (token === secondScannerToken) secondScannerId = device.id;
  }
  const guardedDb: Database = {
    ...db,
    transaction: async (fn) => {
      // Simulate credential changes after middleware authentication but before
      // the inventory route's transaction obtains its device row lock.
      const change = changeBeforeTransaction;
      changeBeforeTransaction = undefined;
      if (change === "rotate")
        await db.query(
          sql`UPDATE devices SET token_hash=${tokenHash(randomBytes(32).toString("base64url"), secret)} WHERE id=${scannerId}`,
        );
      if (change === "disable")
        await db.query(
          sql`UPDATE devices SET status='DISABLED' WHERE id=${scannerId}`,
        );
      return db.transaction(fn);
    },
  };
  const app = buildApp({
    db: guardedDb,
    secret,
    origin: "http://localhost:3000",
    production: false,
    now: () => clock,
  });
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
});
beforeEach(async () => {
  clock = new Date("2026-09-11T05:00:00Z");
  changeBeforeTransaction = undefined;
  await db.query(sql`DELETE FROM sensor_fingerprints`);
  await db.query(
    sql`UPDATE fingerprint_mappings SET fingerprint_id=11 WHERE student_id=${studentId}`,
  );
  await db.query(
    sql`UPDATE devices SET status='ACTIVE',token_hash=${tokenHash(scannerToken, secret)} WHERE id=${scannerId}`,
  );
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (db) await db.close();
});

describe("Sensor fingerprint inventory", () => {
  it("requires the scanner device token and keeps inventory restricted to administrators", async () => {
    expect(
      (await request("/iot/fingerprints", "POST", { fingerprintIds: [11] }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(
          "/iot/fingerprints",
          "POST",
          { fingerprintIds: [11] },
          adminCookie,
        )
      ).status,
    ).toBe(401);
    expect((await sync([11], wasteToken)).body.error.code).toBe(
      "DEVICE_TYPE_MISMATCH",
    );
    expect((await request("/admin/fingerprint-inventory")).status).toBe(401);
    expect(
      (
        await request(
          "/admin/fingerprint-inventory",
          "GET",
          undefined,
          studentCookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/admin/fingerprint-inventory",
          "GET",
          undefined,
          managerCookie,
        )
      ).status,
    ).toBe(200);
    expect((await inventory()).body.data).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("rejects malformed, duplicate, out-of-range, and template payloads without changing inventory", async () => {
    expect((await sync([11])).status).toBe(200);
    for (const body of [
      {},
      { fingerprintIds: null },
      { fingerprintIds: [0] },
      { fingerprintIds: [1001] },
      { fingerprintIds: [1.5] },
      { fingerprintIds: ["11"] },
      { fingerprintIds: [11, 11] },
      { fingerprintIds: Array.from({ length: 1001 }, (_, index) => index + 1) },
      { fingerprintIds: [11], image: "not-accepted" },
      { fingerprintIds: [11], template: "not-accepted" },
    ])
      expect(
        (await request("/iot/fingerprints", "POST", body, scannerToken)).status,
      ).toBe(400);
    const { body } = await inventory();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      fingerprint_id: 11,
      present: true,
    });
  });

  it("upserts successful full inventories and reflects existing student assignments without exposing secrets", async () => {
    const firstTime = clock.toISOString();
    expect((await sync([11, 22])).body.data).toEqual({
      synced: true,
      present: 2,
      syncedAt: firstTime,
    });
    clock = new Date("2026-09-11T05:01:00Z");
    expect((await sync([22, 11])).status).toBe(200);
    const response = await inventory();
    const items = response.body.data.items as FingerprintInventoryRow[];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      device_id: scannerId,
      device_code: "INV_SCANNER",
      device_name: "INV_SCANNER",
      fingerprint_id: 11,
      present: true,
      first_seen: firstTime,
      last_seen: clock.toISOString(),
      student_id: studentId,
      student_code: "INV-STUDENT",
      name: "Inventory Student",
    });
    expect(items[1]).toMatchObject({
      fingerprint_id: 22,
      student_id: null,
      student_code: null,
      name: null,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /token_hash|password_hash|template|image/,
    );
    expect(
      (
        await request(
          "/admin/fingerprints",
          "PUT",
          { studentId, fingerprintId: 22 },
          adminCookie,
        )
      ).status,
    ).toBe(200);
    const assigned = (await inventory()).body.data
      .items as FingerprintInventoryRow[];
    expect(assigned.find((row) => row.fingerprint_id === 22)?.student_id).toBe(
      studentId,
    );
    expect(
      assigned.find((row) => row.fingerprint_id === 11)?.student_id,
    ).toBeNull();
  });

  it("retains absent slots and assignments after removal, empty sync, and reappearance", async () => {
    await sync([11, 22]);
    const firstTime = clock.toISOString();
    clock = new Date("2026-09-11T05:02:00Z");
    await sync([22]);
    let items = (await inventory()).body.data
      .items as FingerprintInventoryRow[];
    expect(items[0]).toMatchObject({ fingerprint_id: 22, present: true });
    expect(items[1]).toMatchObject({
      fingerprint_id: 11,
      present: false,
      first_seen: firstTime,
      last_seen: firstTime,
      student_id: studentId,
    });
    expect((await sync([])).body.data.present).toBe(0);
    items = (await inventory()).body.data.items;
    expect(items).toHaveLength(2);
    expect(items.every((row) => !row.present)).toBe(true);
    expect(
      await db.query(
        sql`SELECT id FROM fingerprint_mappings WHERE student_id=${studentId} AND fingerprint_id=11`,
      ),
    ).toHaveLength(1);
    expect(
      await db.query(sql`SELECT id FROM students WHERE id=${studentId}`),
    ).toHaveLength(1);
    clock = new Date("2026-09-11T05:03:00Z");
    await sync([11]);
    expect((await inventory()).body.data.items[0]).toMatchObject({
      fingerprint_id: 11,
      present: true,
      first_seen: firstTime,
      last_seen: clock.toISOString(),
      student_id: studentId,
    });
  });

  it("keeps snapshots scoped to their device and paginates a full 1000-slot sensor", async () => {
    expect((await sync([11], secondScannerToken)).status).toBe(200);
    expect(
      (await sync(Array.from({ length: 1000 }, (_, index) => index + 1)))
        .status,
    ).toBe(200);
    const page = await request(
      "/admin/fingerprint-inventory?page=2&pageSize=100",
      "GET",
      undefined,
      adminCookie,
    );
    expect(page.body.data).toMatchObject({
      total: 1001,
      page: 2,
      pageSize: 100,
    });
    expect(page.body.data.items).toHaveLength(100);
    expect(
      (
        await request(
          "/admin/fingerprint-inventory?page=0",
          "GET",
          undefined,
          adminCookie,
        )
      ).status,
    ).toBe(400);
    await sync([]);
    const [other] = await db.query<{ present: boolean }>(
      sql`SELECT present FROM sensor_fingerprints WHERE device_id=${secondScannerId} AND fingerprint_id=11`,
    );
    expect(other.present).toBe(true);
  });

  it("serializes concurrent full snapshots instead of producing mixed present slots", async () => {
    const results = await Promise.all([sync([31, 32]), sync([41, 42])]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const present = (
      (await inventory()).body.data.items as FingerprintInventoryRow[]
    )
      .filter((row) => row.present)
      .map((row) => row.fingerprint_id);
    expect([
      [31, 32],
      [41, 42],
    ]).toContainEqual(present);
  });

  it("rechecks disable and token rotation after middleware authentication before changing slots", async () => {
    await sync([11]);
    for (const change of ["disable", "rotate"] as const) {
      changeBeforeTransaction = change;
      const response = await sync([22]);
      expect(response.status).toBe(change === "disable" ? 403 : 401);
      expect(response.body.error.code).toBe(
        change === "disable" ? "DEVICE_DISABLED" : "UNAUTHORIZED_DEVICE",
      );
      const rows = await db.query<{ fingerprint_id: number; present: boolean }>(
        sql`SELECT fingerprint_id,present FROM sensor_fingerprints WHERE device_id=${scannerId}`,
      );
      expect(rows).toEqual([{ fingerprint_id: 11, present: true }]);
      await db.query(
        sql`UPDATE devices SET status='ACTIVE',token_hash=${tokenHash(scannerToken, secret)} WHERE id=${scannerId}`,
      );
    }
  });

  it("cascades only device inventory on device deletion while preserving student mapping", async () => {
    await sync([11], secondScannerToken);
    await db.query(sql`DELETE FROM devices WHERE id=${secondScannerId}`);
    expect(
      await db.query(
        sql`SELECT id FROM sensor_fingerprints WHERE device_id=${secondScannerId}`,
      ),
    ).toHaveLength(0);
    expect(
      await db.query(
        sql`SELECT id FROM fingerprint_mappings WHERE student_id=${studentId}`,
      ),
    ).toHaveLength(1);
  });
});
