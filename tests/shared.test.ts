import { describe, it, expect } from "vitest";
import { localClock, activeMeal, summarize, csv } from "../packages/shared/src";
import { windows, newPassword } from "../packages/validation/src";
import type { MetricRow, Settings, MealWindow } from "../packages/types/src";
const meals: MealWindow[] = [
  {
    meal: "BREAKFAST",
    start_time: "07:30",
    end_time: "09:30",
    cutoff_time: "07:00",
  },
  {
    meal: "LUNCH",
    start_time: "12:00",
    end_time: "14:30",
    cutoff_time: "11:00",
  },
  {
    meal: "DINNER",
    start_time: "19:00",
    end_time: "21:30",
    cutoff_time: "18:00",
  },
];
describe("Calendar and metrics", () => {
  it("uses Kolkata date across UTC midnight", () =>
    expect(localClock(new Date("2026-09-06T19:00:00Z")).date).toBe(
      "2026-09-07",
    ));
  it("uses inclusive start and exclusive end", () => {
    expect(activeMeal(meals, new Date("2026-09-06T02:00Z"))?.meal).toBe(
      "BREAKFAST",
    );
    expect(activeMeal(meals, new Date("2026-09-06T04:00Z"))).toBeNull();
  });
  it("rejects overlap and duplicate windows", () => {
    expect(
      windows.safeParse([
        ...meals.slice(0, 2),
        { ...meals[2], start_time: "13:30" },
      ]).success,
    ).toBe(false);
    expect(windows.safeParse([meals[0], meals[0], meals[2]]).success).toBe(
      false,
    );
  });
  it("does not invent savings when assumptions are missing", () => {
    const s: Settings = {
      costPerKg: null,
      baselineWastePerStudent: null,
      co2PerKg: null,
      waterLitresPerKg: null,
      portionKg: null,
      onlineThresholdMinutes: 5,
    };
    const rows: MetricRow[] = [
      {
        date: "2026-09-06",
        meal: "LUNCH",
        expected: 10,
        actual: 8,
        waste_kg: 1,
        has_waste: true,
        waste_method: "WEIGHED",
        prepared_kg: 4,
        cost: 30,
        predicted_attendance: null,
        predicted_waste: null,
      },
    ];
    expect(summarize(rows, s).savedMoney).toBeNull();
    expect(
      summarize(rows, { ...s, costPerKg: 50, baselineWastePerStudent: 0.25 })
        .savedMoney,
    ).toBe(50);
    expect(summarize([], s).accuracy).toBeNull();
  });
  it("does not count absent sensor readings as savings", () => {
    const settings: Settings = {
      costPerKg: 10,
      baselineWastePerStudent: 0.25,
      co2PerKg: 2,
      waterLitresPerKg: 10,
      portionKg: 0.5,
      onlineThresholdMinutes: 5,
    };
    const row: MetricRow = {
      date: "2026-09-06",
      meal: "LUNCH",
      expected: 10,
      actual: 8,
      waste_kg: 0,
      has_waste: false,
      waste_method: null,
      prepared_kg: 4,
      cost: 30,
      predicted_attendance: null,
      predicted_waste: null,
    };
    expect(summarize([row], settings).savedMoney).toBeNull();
    expect(summarize([row], settings).wastePerStudent).toBeNull();
    expect(summarize([{ ...row, has_waste: true,
      waste_method: "ESTIMATED" }], settings).savedMoney).toBeNull();
    expect(summarize([{ ...row, has_waste: true, waste_method: "WEIGHED" }], settings).savedMoney).toBe(
      20,
    );
  });
  it("rejects passwords that bcrypt would silently truncate", () => {
    expect(newPassword.safeParse("é".repeat(37)).success).toBe(false);
    expect(newPassword.safeParse("é".repeat(36)).success).toBe(true);
  });
  it("escapes CSV quoting and formula injection", () => {
    const result = csv(
      [{ name: "=CMD()", note: 'hello,"world"' }],
      ["name", "note"],
    );
    expect(result).toContain("'=CMD()");
    expect(result).toContain('"hello,""world"""');
  });
});
