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
type ManualWasteRecord = {
  id: string;
  date: string;
  meal: string;
  unserved_kg: number;
  plate_kg: number;
  total_kg: number;
  measurement_method: "WEIGHED" | "ESTIMATED";
  remarks: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
};
type WasteList = Page<ManualWasteRecord> & {
  waste_kg: number;
  weighed_kg: number;
  estimated_kg: number;
  unserved_kg: number;
  plate_kg: number;
};
const meals = ["BREAKFAST", "LUNCH", "DINNER"] as const;
type WasteDraft = {
  date: string;
  meal: string;
  unservedKg: string;
  plateKg: string;
  measurementMethod: "WEIGHED" | "ESTIMATED";
  remarks: string;
};
const emptyWaste = (date: string): WasteDraft => ({
  date, meal: "LUNCH", unservedKg: "", plateKg: "",
  measurementMethod: "WEIGHED", remarks: "",
});
export function WastePage() {
  const today = localClock().date;
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [p, setP] = useState(1);
  const [meal, setMeal] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManualWasteRecord | null>(null);
  const [draft, setDraft] = useState<WasteDraft>(emptyWaste(today));
  const [prepOpen, setPrepOpen] = useState(false);
  const [prep, setPrep] = useState({
    date: today, meal: "LUNCH", weightKg: 0, estimatedCost: 0,
  });
  const records = useRemote<WasteList>(
    `/admin/waste/manual?from=${from}&to=${to}&page=${p}&meal=${meal}`,
  );
  const dash = useRemote<Dashboard>(`/admin/dashboard?from=${from}&to=${to}`);
  const action = useAction();
  const beginNew = () => {
    setEditing(null);
    setDraft(emptyWaste(today));
    setOpen(true);
  };
  const beginEdit = (r: ManualWasteRecord) => {
    setEditing(r);
    setDraft({
      date: r.date,
      meal: r.meal,
      unservedKg: String(r.unserved_kg),
      plateKg: String(r.plate_kg),
      measurementMethod: r.measurement_method,
      remarks: r.remarks,
    });
    setOpen(true);
  };
  const currentTotal = Number(draft.unservedKg || 0) + Number(draft.plateKg || 0);
  return (
    <div className="stack">
      <Heading
        title="Food waste, recorded by people."
        description="Weigh unserved food and plate waste after each meal, or mark quantities as estimated. No connected scale required."
        actions={
          <>
            <Export kind="waste" from={from} to={to} />
            <Button variant="secondary" onClick={() => setPrepOpen(true)}>
              Record preparation
            </Button>
            <Button onClick={beginNew}><Plus size={15} /> Record food waste</Button>
          </>
        }
      />
      <Feedback action={action} />
      <RangeFields from={from} to={to}
        setFrom={(v) => {setFrom(v); setP(1);}}
        setTo={(v) => {setTo(v); setP(1);}} />
      {records.loading ? <Loading /> : records.error ? (
        <Retry error={records.error} reload={records.reload} />
      ) : records.data && (
        <>
          <div className="kpi-grid">
            <Kpi label="Recorded waste"
              value={number(records.data.waste_kg, 2) + " kg"}
              note={`${records.data.total} meal records in selected range`} />
            <Kpi label="Weighed waste"
              value={number(records.data.weighed_kg, 2) + " kg"}
              note="Measured using a regular scale" />
            <Kpi label="Estimated waste"
              value={number(records.data.estimated_kg, 2) + " kg"}
              note="Not independently measured" />
            <Kpi label="Unserved / plate waste"
              value={number(records.data.unserved_kg, 2) + " / " +
                number(records.data.plate_kg, 2) + " kg"}
              note="Separate waste categories" />
          </div>
          {dash.data && (
            <div className="dashboard-grid">
              <section className="card">
                <h3>Recorded waste over time</h3>
                <Trend rows={dash.data.rows} kind="waste" />
              </section>
              <section className="card">
                <h3>Waste by meal</h3>
                <div className="metric-list">
                  {meals.map((m) => (
                    <div key={m}>
                      <span>{m}</span>
                      <strong>{number(dash.data!.rows.filter((r) => r.meal === m)
                        .reduce((n, r) => n + r.waste_kg, 0), 2)} kg</strong>
                    </div>
                  ))}
                </div>
                <small>Weighed and estimated waste are included in the displayed totals,
                  but only weighed records qualify for measurement-based impact estimates.</small>
              </section>
            </div>
          )}
          <div className="between">
            <h2>Manual waste history</h2>
            <Field label="Meal">
              <select value={meal} onChange={(e) => {
                setMeal(e.target.value); setP(1);
              }}>
                <option value="">All meals</option>
                {meals.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <div className="card table-card">
            <Table rows={records.data.items} columns={[
              {key:"date",label:"Date"},
              {key:"meal",label:"Meal"},
              {key:"unserved_kg",label:"Unserved kg",
                render:(r)=>number(r.unserved_kg,3)},
              {key:"plate_kg",label:"Plate kg",
                render:(r)=>number(r.plate_kg,3)},
              {key:"total_kg",label:"Total kg",
                render:(r)=>number(r.total_kg,3)},
              {key:"measurement_method",label:"Method",
                render:(r)=><Badge tone={r.measurement_method==="WEIGHED"?"":"warning"}>
                  {r.measurement_method}</Badge>},
              {key:"recorded_by",label:"Recorded by"},
              {key:"updated_at",label:"Updated",render:(r)=>timestamp(r.updated_at)},
              {key:"edit",label:"Edit",render:(r)=>
                <Button size="small" variant="secondary" onClick={()=>beginEdit(r)}>Edit</Button>},
            ]} />
            <Pager {...records.data} onChange={setP} />
          </div>
        </>
      )}
      <Modal open={open} onClose={()=>setOpen(false)}
        title={editing ? "Correct waste record" : "Record food waste"}
        description="One record per meal. Corrections are saved to the audit history.">
        <form className="stack" onSubmit={(e)=>{
          e.preventDefault();
          void action.run(async()=>{
            const values = {
              unservedKg:Number(draft.unservedKg),
              plateKg:Number(draft.plateKg),
              measurementMethod:draft.measurementMethod,
              remarks:draft.remarks,
            };
            if (draft.unservedKg==="" || draft.plateKg==="")
              throw new Error("Enter both waste amounts, including zero if applicable.");
            if (values.unservedKg < 0 || values.plateKg < 0 ||
              values.unservedKg > 5000 || values.plateKg > 5000 ||
              !Number.isFinite(values.unservedKg) || !Number.isFinite(values.plateKg))
              throw new Error("Enter valid waste quantities between 0 and 5000 kg.");
            await api.request(editing
              ? `/admin/waste/manual/${editing.id}` : "/admin/waste/manual", {
              method:editing ? "PATCH" : "POST",
              body:editing ? values : { ...values, date:draft.date, meal:draft.meal },
            });
            setOpen(false);
            await Promise.all([records.reload(),dash.reload()]);
          }, editing ? "Waste correction saved." : "Waste record saved.");
        }}>
          <div className="fields">
            <Field label="Date (Asia/Kolkata)">
              <input required type="date" max={today}
                value={draft.date} disabled={Boolean(editing)}
                onChange={(e)=>setDraft({...draft,date:e.target.value})}/>
            </Field>
            <Field label="Meal">
              <select required value={draft.meal} disabled={Boolean(editing)}
                onChange={(e)=>setDraft({...draft,meal:e.target.value})}>
                {meals.map((m)=><option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Unserved food (kg)">
              <input required type="number" step="0.001" min="0" max="5000"
                value={draft.unservedKg} onChange={(e)=>
                  setDraft({...draft,unservedKg:e.target.value})}/>
            </Field>
            <Field label="Plate waste (kg)">
              <input required type="number" step="0.001" min="0" max="5000"
                value={draft.plateKg} onChange={(e)=>
                  setDraft({...draft,plateKg:e.target.value})}/>
            </Field>
            <Field label="How was waste determined?">
              <select value={draft.measurementMethod} onChange={(e)=>
                setDraft({...draft,measurementMethod:e.target.value as WasteDraft["measurementMethod"]})}>
                <option value="WEIGHED">Weighed on a kitchen scale</option>
                <option value="ESTIMATED">Estimated, not weighed</option>
              </select>
            </Field>
            <Field label="Notes (optional)">
              <textarea maxLength={500} value={draft.remarks}
                onChange={(e)=>setDraft({...draft,remarks:e.target.value})}/>
            </Field>
          </div>
          <p><strong>Total: {number(currentTotal,3)} kg</strong></p>
          {action.error && <ErrorBox message={action.error}/>}
          <Button type="submit" disabled={action.busy}>
            {action.busy ? "Saving…" : editing ? "Save correction" : "Save waste record"}
          </Button>
        </form>
      </Modal>
      <Modal open={prepOpen} onClose={()=>setPrepOpen(false)}
        title="Record food preparation">
        <form className="stack" onSubmit={(e)=>{
          e.preventDefault();
          void action.run(async()=>{
            await api.request("/admin/preparations",{method:"PUT",body:prep});
            setPrepOpen(false);
            await dash.reload();
          }, "Preparation saved.");
        }}>
          <div className="fields">
            <Field label="Date">
              <input type="date" required value={prep.date} onChange={(e)=>
                setPrep({...prep,date:e.target.value})}/>
            </Field>
            <Field label="Meal">
              <select value={prep.meal} onChange={(e)=>
                setPrep({...prep,meal:e.target.value})}>
                {meals.map((m)=><option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Food prepared (kg)">
              <input type="number" required min="0.001" step="any"
                value={prep.weightKg} onChange={(e)=>
                  setPrep({...prep,weightKg:Number(e.target.value)})}/>
            </Field>
            <Field label="Estimated preparation cost (₹)">
              <input type="number" required min="0" step="any"
                value={prep.estimatedCost} onChange={(e)=>
                  setPrep({...prep,estimatedCost:Number(e.target.value)})}/>
            </Field>
          </div>
          {action.error && <ErrorBox message={action.error}/>}
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
                assumptions, not verified savings. Unweighed estimates are
                excluded from measurement-based impact calculations.
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
            <Badge tone="warning">HISTORICAL BASELINE</Badge>
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
            if (!r.message.startsWith("Historical")) throw new Error(r.message);
          }, "Historical baselines generated.");
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
                  render: (r) => <Badge tone="warning">{r.source}</Badge>,
                },
              ]}
            />
          </div>
        )
      )}
    </div>
  );
}
