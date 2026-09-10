"use client";
import { useState } from "react";
import { Sun, Coffee, Moon, Check, Clock } from "lucide-react";
import type { StudentMeals, Student, Page, HistoryRow } from "@messmate/types";
import { Shell } from "./shell";
import { api, useRemote, useAction } from "./hooks";
import { Heading, Feedback, Retry } from "./admin-common";
import { Button, Loading, Badge, Table, Pager, timestamp } from "./ui";
import { useEntrance } from "./motion";

function AttendanceBadge({ present }: { present: boolean }) {
  const ref = useEntrance<HTMLSpanElement>(
    present,
    present ? "success" : "panel",
  );
  return (
    <span ref={ref} className="attendance-badge">
      <Badge tone={present ? "" : "neutral"}>
        {present ? (
          <>
            <span data-success-icon aria-hidden="true">
              <Check size={12} />
            </span>
            CHECKED IN
          </>
        ) : (
          "NO CHECK-IN"
        )}
      </Badge>
    </span>
  );
}
export function StudentView({ section }: { section: string }) {
  return (
    <Shell area="student">
      {() =>
        section === "profile" ? (
          <Profile />
        ) : section === "history" ? (
          <History />
        ) : (
          <Meals />
        )
      }
    </Shell>
  );
}
function Meals() {
  const [date, setDate] = useState("");
  const { data, error, loading, reload } = useRemote<StudentMeals>(
    "/student/meals" + (date ? "?date=" + date : ""),
    20000,
  );
  const action = useAction();
  if (loading) return <Loading />;
  if (error) return <Retry error={error} reload={reload} />;
  if (!data) return null;
  const tomorrow = new Date(Date.parse(data.date + "T12:00:00Z") + 86400000)
    .toISOString()
    .slice(0, 10);
  return (
    <div className="stack">
      <Heading
        title="A good meal starts with a plan."
        description="Let the kitchen know if you are joining. You can change your response until the deadline."
        actions={
          <Button
            variant="secondary"
            onClick={() => setDate(date ? "" : tomorrow)}
          >
            {date ? "Back to today" : "Plan tomorrow"}
          </Button>
        }
      />
      <Feedback action={action} />
      <div className="between">
        <Badge tone="neutral">{data.date}</Badge>
        <small>Meal times and cutoffs are in Asia/Kolkata.</small>
      </div>
      <div className="meal-grid">
        {data.windows.map((w, i) => {
          const m = data.meals.find((m) => m.meal === w.meal)!;
          const Icon = [Coffee, Sun, Moon][i];
          return (
            <section className="card" key={w.meal}>
              <div className="between">
                <span className="meal-icon">
                  <Icon size={22} />
                </span>
                <Badge tone={m.closed ? "neutral" : ""}>
                  {m.closed ? "RESPONSE CLOSED" : "PLAN YOUR MEAL"}
                </Badge>
              </div>
              <h2 className="serif" style={{ fontSize: 30 }}>
                {w.meal.slice(0, 1) + w.meal.slice(1).toLowerCase()}
              </h2>
              <p className="muted">
                {w.start_time}–{w.end_time}
              </p>
              <div className="row muted" style={{ fontSize: 12 }}>
                <Clock size={14} />
                Respond before {w.cutoff_time}
              </div>
              <div className="meal-choice">
                {["COMING", "NOT_COMING"].map((response) => (
                  <Button
                    key={response}
                    variant={m.response === response ? "primary" : "secondary"}
                    disabled={m.closed || action.busy}
                    aria-pressed={m.response === response}
                    onClick={() =>
                      void action.run(async () => {
                        await api.request("/student/meals", {
                          method: "PUT",
                          body: { date: data.date, meal: w.meal, response },
                        });
                        await reload();
                      }, "Your meal preference is saved.")
                    }
                  >
                    {response === "COMING" ? "I am coming" : "Not coming"}
                  </Button>
                ))}
              </div>
              <div className="divider" />
              <div className="between">
                <small>
                  {m.response ? "Preference saved" : "No response yet"}
                </small>
                <AttendanceBadge present={m.present} />
              </div>
            </section>
          );
        })}
      </div>
      <section className="card">
        <h3>Your response helps the kitchen prepare.</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          A meal preference is your plan to attend. Your fingerprint check-in
          records actual attendance when you arrive at the mess.
        </p>
      </section>
    </div>
  );
}
function History() {
  const [p, setP] = useState(1);
  const { data, error, loading, reload } = useRemote<Page<HistoryRow>>(
    "/student/history?page=" + p,
  );
  return (
    <div className="stack">
      <Heading
        title="Your meal history"
        description="Your plans and attendance, together in one place."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Retry error={error} reload={reload} />
      ) : (
        data && (
          <div className="card table-card">
            <Table
              rows={data.items}
              columns={[
                { key: "date", label: "Date" },
                { key: "meal", label: "Meal" },
                { key: "response", label: "My response" },
                { key: "present", label: "Attendance" },
                {
                  key: "check_in_time",
                  label: "Check-in (IST)",
                  render: (r) =>
                    r.source === "IMPORT"
                      ? "Imported · time unknown"
                      : timestamp(r.check_in_time),
                },
              ]}
            />
            <Pager {...data} onChange={setP} />
          </div>
        )
      )}
    </div>
  );
}
function Profile() {
  const { data, error, loading, reload } =
    useRemote<Student>("/student/profile");
  return (
    <div className="stack">
      <Heading
        title="Your profile"
        description="Contact your mess administrator to update campus details."
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Retry error={error} reload={reload} />
      ) : (
        data && (
          <section className="card" style={{ maxWidth: 750 }}>
            <div className="between">
              <h2>{data.name}</h2>
              <Badge>{data.status}</Badge>
            </div>
            <div className="fields">
              {[
                ["Student ID", data.student_id],
                ["Email", data.email],
                ["Registration", data.registration_number],
                ["Hostel", data.hostel],
                ["Room", data.room_number],
                [
                  "Fingerprint mapping",
                  data.fingerprint_id ? "Assigned" : "Not assigned",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <p>{value}</p>
                </div>
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}
