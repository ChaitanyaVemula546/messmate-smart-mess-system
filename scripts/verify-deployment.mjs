import assert from "node:assert/strict";

const origin = process.env.SMOKE_WEB_ORIGIN;
if (
  !origin ||
  new URL(origin).origin !== origin ||
  !origin.startsWith("https://")
)
  throw new Error(
    "Set SMOKE_WEB_ORIGIN to the exact public HTTPS website origin.",
  );
const get = (path, options = {}) =>
  fetch(origin + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
    ...options,
  });
for (const path of ["/", "/login", "/student/meals", "/admin/attendance"]) {
  const response = await get(path);
  assert.equal(response.status, 200, `Page ${path} must be public HTML`);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
}
const health = await get("/api/health");
assert.equal(health.status, 200, "Database health failed");
assert.equal((await health.json()).data.database, "connected");
assert.equal((await get("/api/admin/students")).status, 401);
assert.equal((await get("/api/student/profile")).status, 401);
for (const path of ["/api/iot/attendance", "/api/iot/waste"]) {
  const response = await get(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(
    response.status,
    401,
    `${path} must require its device credential`,
  );
}
const preflight = await get("/api/auth/login", {
  method: "OPTIONS",
  headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
console.log(
  "Public HTTPS pages, database health, protected APIs, hardware authentication and CORS passed. No records were changed. Login, real device writes and browser checks are separate.",
);
