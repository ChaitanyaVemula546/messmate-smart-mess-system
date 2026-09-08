import { connect, loadEnv, migrate } from "./index";
loadEnv();
const db = await connect(process.env.DATABASE_URL ?? "pglite://.data/messmate");
try {
  await migrate(db);
  console.log("Database migrations applied.");
} finally {
  await db.close();
}
