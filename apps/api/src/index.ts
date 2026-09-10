import { loadEnv } from "@messmate/database";
import { createRuntime } from "./runtime";
loadEnv();
const { db, app } = await createRuntime();
const server = app.listen(
  Number(process.env.API_PORT || 4000),
  process.env.API_HOST || "0.0.0.0",
  () => console.log("MessMate API is listening."),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      db.close().finally(() => process.exit(0));
    });
  });
