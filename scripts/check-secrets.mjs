import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";
import { parse } from "dotenv";
const root = process.cwd();
const knownCredentials = new Set();
function rememberCredential(value) {
  if (typeof value === "string" && value.length >= 16)
    knownCredentials.add(value);
}
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (
    !entry.isFile() ||
    !/^\.env(?:$|\.)/.test(entry.name) ||
    entry.name === ".env.example"
  )
    continue;
  for (const [key, value] of Object.entries(
    parse(readFileSync(resolve(root, entry.name))),
  )) {
    if (/SECRET|PASSWORD|TOKEN/.test(key)) rememberCredential(value);
    if (key === "DATABASE_URL") {
      try {
        const password = new URL(value).password;
        if (password) {
          rememberCredential(value);
          rememberCredential(decodeURIComponent(password));
        }
      } catch {
        // Invalid private URLs must never be echoed by the scanner.
      }
    }
  }
}
function rememberPasswords(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/password|token/i.test(key)) rememberCredential(child);
    rememberPasswords(child);
  }
}
const productionCredentialsPath = resolve(root, ".production-credentials.json");
if (existsSync(productionCredentialsPath)) {
  try {
    rememberPasswords(
      JSON.parse(readFileSync(productionCredentialsPath, "utf8")),
    );
  } catch {
    throw new Error("Unable to read production credentials (values omitted).");
  }
}
const ignored = new Set([
  "node_modules",
  ".git",
  ".next",
  ".data",
  ".expo",
  ".patch-work",
  "dist",
  "build",
  "coverage",
  ".test-output",
]);
const privateName = (name) =>
  (/(^|\/)\.env(?:$|\.)/.test(name) && !name.endsWith(".env.example")) ||
  /(^|\/)(\.(?:demo|production)-credentials\.json|config\.h)$/.test(name) ||
  /\.(keystore|jks|pem|key)$/.test(name);
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  ],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  [
    "encoded bearer token",
    /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b/,
  ],
];
let issues = 0,
  scanned = 0;
function flag(path, kind) {
  issues++;
  console.error(`${path}: ${kind} (value omitted)`);
}
function inspect(name, bytes) {
  if (privateName(name)) {
    flag(name, "private file must not be versioned");
    return;
  }
  if (bytes.includes(0)) return;
  scanned++;
  const content = bytes.toString("utf8");
  for (const value of knownCredentials)
    if (content.includes(value))
      flag(name, "configured private credential in source/history");
  for (const [kind, pattern] of patterns)
    if (pattern.test(content)) flag(name, kind);
  for (const match of content.matchAll(
    /postgres(?:ql)?:\/\/[^\s:@"'<>]+:([^\s@"'<>]+)@/g,
  )) {
    if (!/^(?:YOUR_|CHANGE_|REPLACE_|<|\$)/i.test(match[1]))
      flag(name, "credential in database URL");
  }
  for (const match of content.matchAll(
    /^[ \t]*(?:(?:const|let|var)\s+)?["']?(?:AUTH_SECRET|DEVICE_API_SECRET|DEMO_PASSWORD|WIFI_PASSWORD|DEVICE_TOKEN)["']?\s*(?:=|:)\s*["']([^"'\n]{12,})["']/gm,
  )) {
    if (!/^(?:YOUR_|PASTE_|CHANGE_|REPLACE_|<|\$)/i.test(match[1]))
      flag(name, "literal credential assignment");
  }
}
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      ignored.has(entry.name) ||
      entry.name.endsWith(".zip") ||
      entry.name.endsWith(".bundle")
    )
      continue;
    const path = resolve(dir, entry.name),
      name = relative(root, path).replaceAll("\\", "/");
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && !privateName(name))
      inspect(name, readFileSync(path));
  }
}
if (existsSync(resolve(root, ".git"))) {
  const files = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  for (const file of new Set(files))
    if (existsSync(resolve(root, file)))
      inspect(file, readFileSync(resolve(root, file)));
  let objects = "";
  try {
    objects = execFileSync("git", ["rev-list", "--objects", "--all"], {
      encoding: "utf8",
    });
  } catch {
    /* An empty new repository has no history. */
  }
  for (const line of objects.split("\n").filter(Boolean)) {
    const space = line.indexOf(" ");
    if (space < 0) continue;
    const sha = line.slice(0, space),
      name = line.slice(space + 1);
    const type = execFileSync("git", ["cat-file", "-t", sha], {
      encoding: "utf8",
    }).trim();
    if (type === "blob")
      inspect(
        `history/${name}`,
        execFileSync("git", ["cat-file", "blob", sha]),
      );
  }
} else walk(root);
if (issues) process.exitCode = 1;
else
  console.log(
    `Secret scan passed: ${scanned} source/history text objects; no private files or known credential patterns found.`,
  );
