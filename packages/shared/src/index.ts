import type { MealWindow, MetricRow, Settings, Totals } from "@messmate/types";
export const TIMEZONE = "Asia/Kolkata";
export function localClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}
export function activeMeal(windows: MealWindow[], now = new Date()) {
  const { time } = localClock(now);
  return windows.find((w) => time >= w.start_time && time < w.end_time) ?? null;
}
export function addDays(date: string, n: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function summarize(rows: MetricRow[], s: Settings): Totals {
  const expected = rows.reduce((n, r) => n + r.expected, 0),
    actual = rows.reduce((n, r) => n + r.actual, 0),
    wasteKg = rows.reduce((n, r) => n + r.waste_kg, 0),
    preparedKg = rows.reduce((n, r) => n + (r.prepared_kg ?? 0), 0);
  // Only directly weighed waste is eligible for measurement-based savings.
  // Missing observations must never silently count as 0 kg.
  const complete =
    rows.some((r) => r.has_waste) &&
    rows.filter((r) => r.actual > 0 || r.has_waste)
      .every((r) => r.has_waste && r.waste_method === "WEIGHED");
  const avoidedKg =
    s.baselineWastePerStudent === null || !complete
      ? null
      : Math.max(0, actual * s.baselineWastePerStudent - wasteKg);
  return {
    expected,
    actual,
    wasteKg,
    preparedKg,
    accuracy:
      expected > 0
        ? Math.max(0, 1 - Math.abs(actual - expected) / expected) * 100
        : null,
    wastePerStudent: actual > 0 && complete ? wasteKg / actual : null,
    wastePercentage:
      complete && preparedKg > 0 && rows.every((r) => r.prepared_kg !== null)
        ? (wasteKg / preparedKg) * 100
        : null,
    avoidedKg,
    savedMoney:
      avoidedKg !== null && s.costPerKg !== null
        ? avoidedKg * s.costPerKg
        : null,
    wasteCost:
      s.costPerKg !== null && complete
        ? wasteKg * s.costPerKg
        : null,
    co2Avoided:
      avoidedKg !== null && s.co2PerKg !== null ? avoidedKg * s.co2PerKg : null,
    waterSaved:
      avoidedKg !== null && s.waterLitresPerKg !== null
        ? avoidedKg * s.waterLitresPerKg
        : null,
  };
}
export function csv(rows: Record<string, unknown>[], columns: string[]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [columns, ...rows.map((r) => columns.map((k) => r[k]))]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
