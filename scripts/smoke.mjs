import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const web = process.env.SMOKE_WEB_ORIGIN || "http://localhost:3000";
const api = process.env.SMOKE_API_ORIGIN || "http://localhost:4000";
const requestOrigin = process.env.SMOKE_REQUEST_ORIGIN || web;
const credentials = process.env.SMOKE_PASSWORD
  ? {
      admin: process.env.SMOKE_ADMIN_EMAIL,
      student: process.env.SMOKE_STUDENT_EMAIL,
      password: process.env.SMOKE_PASSWORD,
    }
  : JSON.parse(readFileSync(".demo-credentials.json", "utf8"));
const pages = [
  "/",
  "/login",
  "/admin",
  "/admin/students",
  "/admin/attendance",
  "/admin/fingerprints",
  "/admin/waste",
  "/admin/predictions",
  "/admin/reports",
  "/admin/devices",
  "/admin/settings/meals",
  "/admin/settings",
  "/admin/audit-logs",
  "/student",
  "/student/meals",
  "/student/history",
  "/student/profile",
];
for (const path of pages) {
  const response = await fetch(web + path);
  assert.equal(response.status, 200, `HTML route ${path}`);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
}
assert.equal((await fetch(web + "/api/admin/students")).status, 401);
async function login(email, native) {
  const response = await fetch((native ? api : web) + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(native
        ? { "X-Messmate-Client": "mobile" }
        : { Origin: requestOrigin }),
    },
    body: JSON.stringify({ email, password: credentials.password }),
  });
  assert.equal(response.status, 200, "Login failed");
  const body = await response.json();
  return { body, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const admin = await login(credentials.admin, false);
const student = await login(credentials.student, false);
const native = await login(credentials.student, true);
const clock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const from = new Date(Date.parse(clock + "T12:00:00Z") - 35 * 86400000)
  .toISOString()
  .slice(0, 10);
const range = `from=${from}&to=${clock}`;
const endpoints = [
  "/health",
  "/admin/students",
  "/admin/fingerprints",
  "/admin/attendance",
  "/admin/devices",
  "/admin/settings",
  "/admin/settings/meals",
  "/admin/audit-logs",
  "/admin/dashboard?" + range,
  "/admin/reports?" + range,
  "/admin/waste?" + range,
  "/admin/predictions?" + range,
];
for (const path of endpoints) {
  const response = await fetch(web + "/api" + path, {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(response.status, 200, `API route ${path}`);
  assert.equal((await response.json()).success, true);
}
const webProfile = await (
  await fetch(web + "/api/student/profile", {
    headers: { Cookie: student.cookie },
  })
).json();
const nativeProfile = await (
  await fetch(api + "/api/student/profile", {
    headers: { Authorization: "Bearer " + native.body.data.token },
  })
).json();
assert.equal(
  webProfile.data.id,
  nativeProfile.data.id,
  "Web and mobile must resolve the same student",
);
assert.equal(
  (
    await fetch(web + "/api/admin/students", {
      headers: { Cookie: student.cookie },
    })
  ).status,
  403,
);
for (const kind of [
  "students",
  "attendance",
  "waste",
  "predictions",
  "reports",
]) {
  const response = await fetch(web + `/api/admin/export/${kind}?` + range, {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.ok((await response.text()).length > 0);
}
const timings = [];
for (let i = 0; i < 8; i++) {
  const start = performance.now();
  const response = await fetch(web + "/api/admin/dashboard?" + range, {
    headers: { Cookie: admin.cookie },
  });
  assert.equal(response.status, 200);
  await response.json();
  timings.push(performance.now() - start);
}
for (const session of [admin, student])
  await fetch(web + "/api/auth/logout", {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      Cookie: session.cookie,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
await fetch(api + "/api/auth/logout", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + native.body.data.token,
    "Content-Type": "application/json",
  },
  body: "{}",
});
console.log(
  JSON.stringify(
    {
      htmlRoutes: pages.length,
      apiReadRoutes: endpoints.length,
      csvExports: 5,
      webNativeIdentity: "same database student",
      authorization: "401/403 verified",
      dashboardPeriodDays: 36,
      requests: timings.length,
      meanDashboardMs: Math.round(
        timings.reduce((a, b) => a + b, 0) / timings.length,
      ),
      maxDashboardMs: Math.round(Math.max(...timings)),
      browserVisualTest: false,
    },
    null,
    2,
  ),
);
