"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import type { MetricRow, Settings } from "@messmate/types";
import { summarize } from "@messmate/shared";
export function Trend({
  rows,
  kind = "attendance",
  settings,
}: {
  rows: MetricRow[];
  kind?: "attendance" | "waste" | "prediction" | "savings" | "accuracy";
  settings?: Settings;
}) {
  const dates = [...new Set(rows.map((r) => r.date))];
  const data = dates.map((date) => {
    const group = rows.filter((r) => r.date === date);
    return {
      date: date.slice(5),
      Expected: group.reduce((n, r) => n + r.expected, 0),
      Actual: group.reduce((n, r) => n + r.actual, 0),
      Waste: group.some((r) => r.has_waste)
        ? Number(group.reduce((n, r) => n + r.waste_kg, 0).toFixed(2))
        : null,
      Predicted: group.some((r) => r.predicted_attendance !== null)
        ? group.reduce((n, r) => n + (r.predicted_attendance ?? 0), 0)
        : null,
      Savings: settings ? summarize(group, settings).savedMoney : null,
      Accuracy: settings ? summarize(group, settings).accuracy : null,
    };
  });
  return (
    <div className="chart" aria-label={kind + " trend"}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "waste" ? (
          <AreaChart data={data}>
            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="#e8ece3"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip />
            <Area
              dataKey="Waste"
              name="Waste (kg)"
              stroke="#688455"
              fill="#e7eedb"
              strokeWidth={2}
            />
          </AreaChart>
        ) : kind === "savings" || kind === "accuracy" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={35} />
            <Tooltip />
            <Line
              dataKey={kind === "savings" ? "Savings" : "Accuracy"}
              stroke="#327352"
              strokeWidth={2}
              connectNulls={false}
            />
          </LineChart>
        ) : (
          <BarChart data={data} barGap={4}>
            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="#e8ece3"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={35}
            />
            <Tooltip cursor={{ fill: "#f1f5e9" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            <Bar
              dataKey={kind === "prediction" ? "Predicted" : "Expected"}
              fill="#c8d6ae"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
            <Bar
              dataKey="Actual"
              fill="#357556"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function MealChart({ rows }: { rows: MetricRow[] }) {
  const data = ["BREAKFAST", "LUNCH", "DINNER"].map((meal) => ({
    meal: meal.slice(0, 1) + meal.slice(1).toLowerCase(),
    Expected: rows
      .filter((r) => r.meal === meal)
      .reduce((n, r) => n + r.expected, 0),
    Actual: rows
      .filter((r) => r.meal === meal)
      .reduce((n, r) => n + r.actual, 0),
  }));
  return (
    <div className="chart small">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="meal"
            tick={{ fontSize: 10 }}
            width={66}
          />
          <Tooltip />
          <Bar dataKey="Expected" fill="#cedbb6" radius={[0, 3, 3, 0]} />
          <Bar dataKey="Actual" fill="#407957" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
