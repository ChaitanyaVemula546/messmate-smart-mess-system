import { connect, loadEnv, sql } from "../packages/database/src";
import { adminUser } from "../packages/validation/src";
import { hash } from "bcryptjs";
loadEnv();
const input = adminUser.safeParse({
  email: process.env.BOOTSTRAP_ADMIN_EMAIL,
  name: process.env.BOOTSTRAP_ADMIN_NAME,
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  role: "ADMIN",
});
if (!input.success)
  throw new Error(
    "Inject a valid bootstrap email, name and a password of 12 characters to 72 UTF-8 bytes via the environment.",
  );
const { email, name, password } = input.data;
const db = await connect(process.env.DATABASE_URL ?? "");
try {
  const passwordHash = await hash(password, 12);
  await db.transaction(async (tx) => {
    await tx.query(sql`LOCK TABLE users IN EXCLUSIVE MODE`);
    if (
      (await tx.query(sql`SELECT id FROM users WHERE role='ADMIN' LIMIT 1`))
        .length
    )
      throw new Error("An administrator already exists; bootstrap refused.");
    await tx.query(
      sql`INSERT INTO users(email,name,password_hash,role) VALUES(${email.toLowerCase()},${name},${passwordHash},'ADMIN')`,
    );
  });
  console.log(
    "Initial administrator created. Clear the bootstrap environment values.",
  );
} finally {
  await db.close();
}
