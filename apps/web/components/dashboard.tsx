"use client";
import {
  Users,
  CheckCircle2,
  Scale,
  ArrowUpRight,
  Radio,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { summarize } from "@messmate/shared";
import type { Dashboard as Data } from "@messmate/types";
import { useRemote } from "./hooks";
import { Kpi, Loading, Badge, number, Table } from "./ui";
import { Heading, Retry } from "./admin-common";
import { Trend, MealChart } from "./charts";
import { AnimatedNumber } from "./motion";
export function Dashboard() {
  const { data, error, loading, reload } = useRemote<Data>(
    "/admin/dashboard",
    20000,
  );
  if (loading) return <Loading />;
  if (error) return <Retry error={error} reload={reload} />;
  if (!data) return null;
  const today = summarize(data.today, data.settings),
    current = data.currentMeal,
    meal = current ? data.today.find((r) => r.meal === current.meal) : null;
  return (
    <div className="stack">
      <Heading
        title="A clearer picture of your mess."
        description="Plan thoughtfully. Follow attendance. Understand what is left behind."
        actions={
          <Badge tone="neutral">
            <CalendarDays size={12} />
            {data.date}
          </Badge>
        }
      />
      <div className="kpi-grid">
        <Kpi
          label="Expected today"
          value={number(today.expected, 0)}
          note="Students who selected coming"
          icon={<Users size={17} />}
        />
        <Kpi
          label="Checked in today"
          value={number(today.actual, 0)}
          note="Verified and recorded attendance"
          icon={<CheckCircle2 size={17} />}
        />
        <Kpi
          label="Recorded waste"
          value={
            <>
              {data.today.some((r) => r.has_waste) ? (
                <AnimatedNumber value={today.wasteKg} digits={2} />
              ) : (
                "—"
              )}{" "}
              <small style={{ fontSize: 15 }}>kg</small>
            </>
          }
          note="Today · staff-recorded (weighed or estimated)"
          icon={<Scale size={17} />}
        />
        <Kpi
          label="Attendance accuracy"
          value={
            today.accuracy === null ? "—" : number(today.accuracy, 0) + "%"
          }
          note={
            today.accuracy === null
              ? "Awaiting expected attendance"
              : "Compared with meal intentions"
          }
          icon={<ArrowUpRight size={17} />}
        />
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="between">
            <div>
              <h3 style={{ marginBottom: 4 }}>Expected meets actual</h3>
              <small>The last seven days of meal attendance</small>
            </div>
            <Badge tone="neutral">7 DAYS</Badge>
          </div>
          <Trend rows={data.rows} />
        </section>
        <section className="card live-card">
          <div className="between">
            <Badge>{current ? "MEAL IN PROGRESS" : "BETWEEN MEALS"}</Badge>
            <span style={{ fontSize: 11 }}>{data.time.slice(0, 5)} IST</span>
          </div>
          <h2 className="serif" style={{ fontSize: 34, margin: "23px 0 8px" }}>
            {current
              ? current.meal.slice(0, 1) + current.meal.slice(1).toLowerCase()
              : "Ready for the next meal."}
          </h2>
          <p className="muted">
            {current
              ? `${current.start_time}–${current.end_time} · ${data.date}`
              : "Attendance will open during the next configured meal window."}
          </p>
          {meal && (
            <>
              <div className="between">
                <strong style={{ fontSize: 30 }}>
                  <AnimatedNumber value={meal.actual} />
                  <span
                    className="muted"
                    style={{ fontSize: 14, fontWeight: 400 }}
                  >
                    {" "}
                    / {meal.expected} expected
                  </span>
                </strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: meal.expected
                      ? `${(meal.actual / meal.expected) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <div className="metric-list">
                <div>
                  <span>Remaining expected count</span>
                  <strong>
                    <AnimatedNumber
                      value={Math.max(0, meal.expected - meal.actual)}
                    />
                  </strong>
                </div>
                <div>
                  <span>Waste recorded</span>
                  <strong>
                    {meal.has_waste ? (
                      <>
                        <AnimatedNumber value={meal.waste_kg} digits={2} /> kg
                      </>
                    ) : (
                      "Not recorded"
                    )}
                  </strong>
                </div>
              </div>
            </>
          )}
          <div className="divider" />
          <Link
            href="/admin/attendance"
            className="row"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            Open attendance <ArrowUpRight size={15} />
          </Link>
          <small style={{ display: "block", marginTop: 18 }}>
            Refreshes every 20 seconds
          </small>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="between">
            <div>
              <h3 style={{ marginBottom: 4 }}>Make waste visible</h3>
              <small>
                Recorded food waste · weighed or estimated · last seven days
              </small>
            </div>
            <Link href="/admin/waste" className="muted">
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <Trend rows={data.rows} kind="waste" />
        </section>
        <section className="card">
          <h3>Attendance by meal</h3>
          <small>Expected and actual · last seven days</small>
          <MealChart rows={data.rows} />
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="between">
            <h3>Today, meal by meal</h3>
            <Badge tone="neutral">LIVE DATA</Badge>
          </div>
          <Table
            rows={data.today}
            columns={[
              { key: "meal", label: "Meal" },
              { key: "expected", label: "Expected" },
              { key: "actual", label: "Actual" },
              {
                key: "waste_kg",
                label: "Waste",
                render: (r) =>
                  r.has_waste ? number(r.waste_kg, 2) + " kg" : "Not recorded",
              },
            ]}
          />
        </section>
        <section className="card">
          <div className="between">
            <h3>System connections</h3>
            <Radio size={17} />
          </div>
          <div className="metric-list">
            <div>
              <span>Shared API</span>
              <Badge>RESPONDING</Badge>
            </div>
            <div>
              <span>Database</span>
              <Badge>CONNECTED</Badge>
            </div>
            {data.devices.slice(0, 3).map((d) => (
              <div key={d.id}>
                <span>{d.name}</span>
                <Badge tone={d.online ? "" : "neutral"}>
                  {d.status === "DISABLED"
                    ? "DISABLED"
                    : d.online
                      ? "ONLINE"
                      : "OFFLINE"}
                </Badge>
              </div>
            ))}
            {!data.devices.length && (
              <p className="muted">
                Register a device to connect your dining hall.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
