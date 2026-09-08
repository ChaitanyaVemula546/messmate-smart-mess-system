import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log("Existing development configuration preserved.");
  process.exit(0);
}
const password = randomBytes(18).toString("base64url");
const text = readFileSync(".env.example", "utf8")
  .replace("AUTH_SECRET=", "AUTH_SECRET=" + randomBytes(48).toString("hex"))
  .replace("DEMO_PASSWORD=", "DEMO_PASSWORD=" + password);
writeFileSync(".env", text, { mode: 0o600 });
writeFileSync(
  ".demo-credentials.json",
  JSON.stringify(
    {
      notice: "Development only. Do not share or commit.",
      admin: "admin@messmate.local",
      messAdmin: "manager@messmate.local",
      student: "student01@messmate.local",
      password,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  "Private development configuration created. Read .demo-credentials.json locally for seeded account access.",
);
