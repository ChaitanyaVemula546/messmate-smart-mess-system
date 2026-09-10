"use client";
import { AnimatedNumber } from "./motion";
import { useState } from "react";
import { Plus, Printer, Sparkles } from "lucide-react";
import { addDays, localClock } from "@messmate/shared";
import type { Dashboard, Page, Prediction } from "@messmate/types";
import { api, useAction, useRemote } from "./hooks";
import { Heading, Feedback, Retry, Export } from "./admin-common";
import {
  Button,
  Field,
  Modal,
  Table,
  Pager,
  Kpi,
  Loading,
  Badge,
  number,
  ErrorBox,
  timestamp,
} from "./ui";
import { Trend } from "./charts";
function RangeFields({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="toolbar no-print">
      <Field label="From">
        <input
          type="date"
          required
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </Field>
      {[
        ["Today", 0],
        ["Week", 6],
        ["Month", 29],
      ].map(([label, days]) => (
        <Button
          key={label}
          variant="secondary"
          onClick={() => {
            const today = localClock().date;
            setTo(today);
            setFrom(addDays(today, -Number(days)));
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
export function WastePage() {
  const today = localClock().date;
  const [from, setFrom] = useState(addDays(today, -6)),
    [to, setTo] = useState(today),
    [p, setP] = useState(1),
    [meal, setMeal] = useState(""),
    [open, setOpen] = useState(false),
    [form, setForm] = useState({
      date: today,
      meal: "LUNCH",
      weightKg: 0,
      estimatedCost: 0,
    });
  const dash = useRemote<Dashboard>(`/admin/dashboard?from=${from}&to=${to}`),
    readings = useRemote<
      Page<Record<string, unknown>> & { wasteKg: number; unassignedKg: number }
    >(`/admin/waste?from=${from}&to=${to}&page=${p}&meal=${meal}`),
    action = useAction();
  return (
    <div className="stack">
      <Heading
        title="Measure more. Waste less."
        description="Track food waste from your connected bins, with preparation and cost context."
        actions={
          <>
            <Export kind="waste" from={from} to={to} />
            <Button onClick={() => setOpen(true)}>
              <Plus size={15} />
              Record preparation
            </Button>
          </>
        }
      />
      <Feedback action={action} />
      <RangeFields
        from={from}
        to={to}
        setFrom={(v) => {
          setFrom(v);
          setP(1);
        }}
        setTo={(v) => {
          setTo(v);
          setP(1);
        }}
      />
      {dash.loading ? (
        <Loading />
      ) : dash.error ? (
        <Retry error={dash.error} reload={dash.reload} />
      ) : (
        dash.data && (
          <>
            <div className="kpi-grid">
              <Kpi
                label="Meal-attributed waste"
                value={
                  dash.data.rows.some((r) => r.has_waste)
                    ? number(dash.data.totals.wasteKg, 2) + " kg"
                    : "—"
                }
                note="Selected date range"
              />
              <Kpi
                label="Waste per check-in"
                value={
                  dash.data.totals.wastePerStudent === null
                    ? "—"
                    : number(dash.data.totals.wastePerStudent, 3) + " kg"
                }
              />
              <Kpi
                label="Waste / prepared food"
                value={
                  dash.data.totals.wastePercentage === null
                    ? "—"
                    : number(dash.data.totals.wastePercentage) + "%"
                }
                note="Requires preparation for every meal"
              />
              <Kpi
                label="Estimated waste cost"
                value={
                  dash.data.totals.wasteCost === null
                    ? "Unavailable"
                    : "₹" + number(dash.data.totals.wasteCost)
                }
                note="Measured waste × configured cost/kg"
              />
            </div>
            <div className="dashboard-grid">
              <div className="card">
                <h3>Food waste over time</h3>
                <Trend rows={dash.data.rows} kind="waste" />
              </div>
              <div className="card">
                <h3>Waste by meal</h3>
                <div className="metric-list">
                  {["BREAKFAST", "LUNCH", "DINNER"].map((m) => (
                    <div key={m}>
                      <span>{m}</span>
                      <strong>
                        {number(
                          dash
                            .data!.rows.filter((r) => r.meal === m)
                            .reduce((n, r) => n + r.waste_kg, 0),
                          2,
                        )}{" "}
                        kg
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <small>
                  Estimates depend on recorded preparation and configured
                  assumptions. Raw cumulative readings are not added together.
                </small>
              </div>
            </div>
          </>
        )
      )}
      <div className="between">
        <h2>Bin readings</h2>
        <Field label="Filter meal">
          <select
            value={meal}
            onChange={(e) => {
              setMeal(e.target.value);
              setP(1);
            }}
          >
            <option value="">All meals</option>
            {["BREAKFAST", "LUNCH", "DINNER", "UNASSIGNED"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      {readings.error ? (
        <Retry error={readings.error} reload={readings.reload} />
      ) : (
        readings.data && (
          <>
            <small>
              Filtered net waste: {number(readings.data.wasteKg, 2)} kg ·
              Outside meal windows: {number(readings.data.unassignedKg, 2)} kg
            </small>
            <div className="card table-card">
              <Table
                rows={readings.data.items}
                columns={[
                  { key: "date", label: "Date" },
                  { key: "meal", label: "Meal" },
                  { key: "device_id", label: "Device" },
                  { key: "weight_kg", label: "Scale kg" },
                  {
                    key: "delta_kg",
                    label: "Added waste kg",
                    render: (r) => number(Number(r.delta_kg), 3),
                  },
                  {
                    key: "tare",
                    label: "Reading type",
                    render: (r) => (
                      <Badge tone="neutral">
                        {r.tare ? "TARE" : "SNAPSHOT"}
                      </Badge>
                    ),
                  },
                  {
                    key: "measured_at",
                    label: "Measured (IST)",
                    render: (r) => timestamp(r.measured_at),
                  },
                ]}
              />
              <Pager {...readings.data} onChange={setP} />
            </div>
          </>
        )
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record food preparation"
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.request("/admin/preparations", {
                method: "PUT",
                body: form,
              });
              setOpen(false);
              await dash.reload();
            });
          }}
        >
          <div className="fields">
            <Field label="Date">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Meal">
              <select
                value={form.meal}
                onChange={(e) => setForm({ ...form, meal: e.target.value })}
              >
                {["BREAKFAST", "LUNCH", "DINNER"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Food prepared (kg)">
              <input
                type="number"
                min={0.01}
                step="any"
                required
                value={form.weightKg}
                onChange={(e) =>
                  setForm({ ...form, weightKg: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Estimated preparation cost (₹)">
              <input
                type="number"
                min={0}
                step="any"
                required
                value={form.estimatedCost}
                onChange={(e) =>
                  setForm({ ...form, estimatedCost: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          {action.error && <ErrorBox message={action.error} />}
          <Button disabled={action.busy}>Save preparation</Button>
        </form>
      </Modal>
    </div>
  );
}
export function Reports() {
  const today = localClock().date,
    [from, setFrom] = useState(addDays(today, -6)),
    [to, setTo] = useState(today);
  const remote = useRemote<Dashboard>(`/admin/reports?from=${from}&to=${to}`);
  return (
    <div className="stack">
      <div className="print-only">
        <h1>MessMate dining report</h1>
        <p>
          {from} to {to} · Asia/Kolkata
        </p>
      </div>
      <Heading
        title="Make the next meal better."
        description={`Dining report · ${from} to ${to} · all figures use recorded activity.`}
        actions={
          <>
            <Export kind="reports" from={from} to={to} />
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} />
              Print report
            </Button>
          </>
        }
      />
      <RangeFields {...{ from, to, setFrom, setTo }} />
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        remote.data && (
          <>
            <div className="kpi-grid">
              <Kpi
                label="Expected attendance"
                value={number(remote.data.totals.expected, 0)}
              />
              <Kpi
                label="Actual attendance"
                value={number(remote.data.totals.actual, 0)}
              />
              <Kpi
                label="Food waste"
                value={
                  remote.data.rows.some((r) => r.has_waste)
                    ? number(remote.data.totals.wasteKg, 2) + " kg"
                    : "—"
                }
              />
              <Kpi
                label="Estimated money saved"
                value={
                  remote.data.totals.savedMoney === null
                    ? "Unavailable"
                    : "₹" + number(remote.data.totals.savedMoney)
                }
                note="Baseline avoided excess food cost"
              />
            </div>
            <div className="dashboard-grid">
              <div className="card">
                <h3>Attendance trend</h3>
                <Trend rows={remote.data.rows} />
              </div>
              <div className="card">
                <h3>Waste trend</h3>
                <Trend rows={remote.data.rows} kind="waste" />
              </div>
            </div>
            <div className="dashboard-grid">
              <div className="card">
                <h3>Estimated money saved</h3>
                {remote.data.settings.costPerKg === null ||
                remote.data.settings.baselineWastePerStudent === null ? (
                  <p className="muted">
                    Configure a cost per kilogram and baseline waste per student
                    in settings.
                  </p>
                ) : (
                  <Trend
                    rows={remote.data.rows}
                    settings={remote.data.settings}
                    kind="savings"
                  />
                )}
              </div>
              <div className="card">
                <h3>Attendance accuracy trend</h3>
                <Trend
                  rows={remote.data.rows}
                  settings={remote.data.settings}
                  kind="accuracy"
                />
              </div>
            </div>
            <div className="card">
              <h3>Estimated environmental impact</h3>
              <div className="fields">
                <p>
                  Food waste avoided
                  <br />
                  <strong>
                    <AnimatedNumber
                      value={remote.data.totals.avoidedKg}
                      digits={2}
                    />
                    {remote.data.totals.avoidedKg !== null ? " kg" : ""}
                  </strong>
                </p>
                <p>
                  CO₂ equivalent avoided
                  <br />
                  <strong>
                    <AnimatedNumber
                      value={remote.data.totals.co2Avoided}
                      digits={2}
                    />
                    {remote.data.totals.co2Avoided !== null ? " kg CO₂e" : ""}
                  </strong>
                </p>
                <p>
                  Water saved
                  <br />
                  <strong>
                    <AnimatedNumber value={remote.data.totals.waterSaved} />
                    {remote.data.totals.waterSaved !== null ? " litres" : ""}
                  </strong>
                </p>
                <p>
                  Waste per check-in
                  <br />
                  <strong>
                    {remote.data.totals.wastePerStudent === null ? (
                      "—"
                    ) : (
                      <AnimatedNumber
                        value={remote.data.totals.wastePerStudent}
                        digits={3}
                        suffix=" kg"
                      />
                    )}
                  </strong>
                </p>
              </div>
              <small>
                Estimates compare recorded meal waste with your configured
                baseline. Conversion factors are assumptions, not direct
                measurements. Out-of-window waste is shown separately on the
                waste page.
              </small>
            </div>
            <div className="card table-card">
              <Table
                rows={remote.data.rows}
                columns={[
                  { key: "date", label: "Date" },
                  { key: "meal", label: "Meal" },
                  { key: "expected", label: "Expected" },
                  { key: "actual", label: "Actual" },
                  {
                    key: "waste_kg",
                    label: "Waste kg",
                    render: (r) => (r.has_waste ? number(r.waste_kg, 2) : "—"),
                  },
                  { key: "prepared_kg", label: "Prepared kg" },
                ]}
              />
            </div>
          </>
        )
      )}
    </div>
  );
}
export function Predictions() {
  const today = localClock().date,
    [date, setDate] = useState(addDays(today, 1)),
    [holiday, setHoliday] = useState(false),
    [event, setEvent] = useState("");
  const remote = useRemote<Prediction[]>(
      `/admin/predictions?from=${addDays(today, -30)}&to=${addDays(today, 7)}`,
    ),
    action = useAction();
  return (
    <div className="stack">
      <Heading
        title="Plan a little further ahead."
        description="A transparent historical baseline. Ready for a trained model when your data is ready."
        actions={
          <>
            <Badge tone="warning">DEMO PREDICTION</Badge>
            <Export
              kind="predictions"
              from={addDays(today, -30)}
              to={addDays(today, 7)}
            />
          </>
        }
      />
      <Feedback action={action} />
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const r = await api.request<{ message: string }>(
              "/admin/predictions",
              { method: "POST", body: { date, holiday, specialEvent: event } },
            );
            await remote.reload();
            if (!r.message.startsWith("Demo")) throw new Error(r.message);
          }, "Demo predictions generated.");
        }}
      >
        <div className="toolbar">
          <Field label="Forecast date">
            <input
              required
              type="date"
              min={addDays(today, 1)}
              max={addDays(today, 7)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Special event (optional)">
            <input
              maxLength={200}
              value={event}
              onChange={(e) => setEvent(e.target.value)}
            />
          </Field>
          <label className="row">
            <input
              type="checkbox"
              checked={holiday}
              onChange={(e) => setHoliday(e.target.checked)}
            />
            Holiday
          </label>
          <Button disabled={action.busy}>
            <Sparkles size={16} />
            Generate baseline
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api.request("/admin/predictions/evaluate", {
                  method: "POST",
                  body: {},
                });
                await remote.reload();
              }, "Completed meal forecasts evaluated.")
            }
          >
            Evaluate past forecasts
          </Button>
        </div>
        <small>
          Uses the average of up to 28 observed meal dates in the previous 90
          days. Requires at least three dates. Holiday and event inputs are
          stored for future model use. Confidence is not calculated.
        </small>
      </form>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        remote.data && (
          <div className="card table-card">
            <Table
              rows={remote.data}
              columns={[
                { key: "date", label: "Date" },
                { key: "meal", label: "Meal" },
                { key: "attendance", label: "Predicted attendance" },
                {
                  key: "waste_kg",
                  label: "Predicted waste kg",
                  render: (r) => number(r.waste_kg, 2),
                },
                {
                  key: "food_kg",
                  label: "Recommended food kg",
                  render: (r) => number(r.food_kg, 2),
                },
                { key: "sample_count", label: "Sample dates" },
                { key: "actual_attendance", label: "Actual" },
                { key: "absolute_error", label: "Absolute error" },
                {
                  key: "accuracy",
                  label: "Accuracy",
                  render: (r) =>
                    r.accuracy === null ? "—" : number(r.accuracy) + "%",
                },
                {
                  key: "source",
                  label: "Source",
                  render: () => <Badge tone="warning">DEMO PREDICTION</Badge>,
                },
              ]}
            />
          </div>
        )
      )}
    </div>
  );
}
