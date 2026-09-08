import { connect, loadEnv, migrate, sql } from "./index";
import { hash } from "bcryptjs";
import { randomBytes, createHmac } from "node:crypto";
import { addDays, localClock } from "@messmate/shared";
loadEnv();
if (process.env.NODE_ENV === "production")
  throw new Error("Development seeding is disabled in production.");
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Run pnpm setup or supply a private DEMO_PASSWORD of at least 12 characters.",
  );
const db = await connect(process.env.DATABASE_URL ?? "pglite://.data/messmate");
try {
  await migrate(db);
  if ((await db.query(sql`SELECT id FROM users LIMIT 1`)).length)
    throw new Error(
      "Seed requires an empty user table; existing data was preserved.",
    );
  const passwordHash = await hash(password, 12);
  const today = localClock().date;
  await db.transaction(async (tx) => {
    await tx.query(
      sql`INSERT INTO users(email,name,password_hash,role) VALUES ('admin@messmate.local','Demo Administrator',${passwordHash},'ADMIN'),('manager@messmate.local','Demo Mess Manager',${passwordHash},'MESS_ADMIN')`,
    );
    const people = [];
    for (let i = 1; i <= 36; i++) {
      const [u] = await tx.query<{ id: string }>(
        sql`INSERT INTO users(email,name,password_hash,role) VALUES(${`student${String(i).padStart(2, "0")}@messmate.local`},${`Demo Student ${String(i).padStart(2, "0")}`},${passwordHash},'STUDENT') RETURNING id`,
      );
      const [s] = await tx.query<{ id: string }>(
        sql`INSERT INTO students(user_id,student_id,registration_number,hostel,room_number) VALUES(${u.id},${`MM${1000 + i}`},${`EIE2024${String(i).padStart(3, "0")}`},${i % 2 ? "Cauvery" : "Krishna"},${String(100 + i)}) RETURNING id`,
      );
      people.push(s.id);
      await tx.query(
        sql`INSERT INTO fingerprint_mappings(student_id,fingerprint_id) VALUES(${s.id},${i})`,
      );
    }
    const tokenHash = createHmac(
      "sha256",
      process.env.AUTH_SECRET ?? "seed-only",
    )
      .update(randomBytes(32))
      .digest("hex");
    const [device] = await tx.query<{ id: string }>(
      sql`INSERT INTO devices(device_id,name,type,token_hash,status) VALUES('DEMO_WASTE','Demo waste station','WASTE_MONITOR',${tokenHash},'DISABLED') RETURNING id`,
    );
    for (let days = 35; days >= 0; days--) {
      const date = addDays(today, -days);
      for (const meal of ["BREAKFAST", "LUNCH", "DINNER"]) {
        let actual = 0;
        for (let i = 0; i < people.length; i++) {
          const coming = (i + days) % 7 !== 0;
          await tx.query(
            sql`INSERT INTO meal_preferences(student_id,date,meal,response) VALUES(${people[i]},${date},${meal},${coming ? "COMING" : "NOT_COMING"})`,
          );
          if (days > 0 && (i + days) % 9 !== 0) {
            actual++;
            await tx.query(
              sql`INSERT INTO attendance(student_id,date,meal,check_in_time,source,reason) VALUES(${people[i]},${date},${meal},${date + "T" + (meal === "BREAKFAST" ? "02:30" : meal === "LUNCH" ? "07:00" : "14:00") + ":00Z"},'IMPORT','Explicit fictional development seed')`,
            );
          }
        }
        if (days > 0) {
          const waste = Number(
            (1.3 + (days % 7) * 0.19 + (meal === "LUNCH" ? 0.7 : 0)).toFixed(2),
          );
          await tx.query(
            sql`INSERT INTO waste_measurements(device_id,measurement_id,weight_kg,delta_kg,tare_session,date,meal,measured_at) VALUES(${device.id},gen_random_uuid(),${waste},${waste},${days},${date},${meal},${date + "T14:00:00Z"})`,
          );
          await tx.query(
            sql`INSERT INTO food_preparations(date,meal,weight_kg,estimated_cost) VALUES(${date},${meal},${actual * 0.48},${actual * 32})`,
          );
        }
      }
    }
    await tx.query(
      sql`INSERT INTO audit_logs(action,entity,metadata) VALUES('DEVELOPMENT_SEED','system','{"fictional":true,"students":36,"historyDays":35}')`,
    );
  });
  console.log(
    "Seeded 36 fictional students and 35 completed days. Credentials are in your private development setup file.",
  );
} finally {
  await db.close();
}
