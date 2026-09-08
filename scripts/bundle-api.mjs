import { build } from "esbuild";
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/server.js",
  external: [
    "pg",
    "@electric-sql/pglite",
    "express",
    "cors",
    "helmet",
    "cookie-parser",
    "bcryptjs",
    "csv-parse/sync",
    "dotenv",
  ],
  target: "node22",
});
