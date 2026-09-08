import { connect, loadEnv, sql } from "../packages/database/src";
loadEnv();
const db = await connect(process.env.DATABASE_URL ?? "");
try {
  await db.transaction(async (tx) => {
    await tx.query(sql`DELETE FROM sessions WHERE expires_at<now()`);
    await tx.query(sql`DELETE FROM rate_limits WHERE expires_at<now()`);
  });
  console.log("Expired sessions and rate-limit entries removed.");
} finally {
  await db.close();
}
