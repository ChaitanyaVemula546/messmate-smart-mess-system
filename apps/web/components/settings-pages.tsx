"use client";
import Link from "next/link";
import { useState } from "react";
import type { MealWindow, Settings, Page, Audit } from "@messmate/types";
import { api, useAction, useRemote } from "./hooks";
import { Heading, Feedback, Retry } from "./admin-common";
import {
  Button,
  Field,
  Loading,
  ErrorBox,
  Table,
  Pager,
  timestamp,
} from "./ui";
export function MealSettings() {
  const remote = useRemote<MealWindow[]>("/admin/settings/meals"),
    action = useAction(),
    [draft, setDraft] = useState<MealWindow[] | null>(null);
  const values = draft ?? remote.data;
  return (
    <div className="stack">
      <Heading
        title="Meal windows & response deadlines"
        description="All schedules use Asia/Kolkata. Attendance opens at the start and closes at the end."
      />
      <Feedback action={action} />
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        values && (
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api.request("/admin/settings/meals", {
                  method: "PUT",
                  body: values,
                });
                await remote.reload();
              });
            }}
          >
            {values.map((w, i) => (
              <div key={w.meal}>
                <h3>{w.meal}</h3>
                <div className="fields">
                  {(["start_time", "end_time", "cutoff_time"] as const).map(
                    (k) => (
                      <Field
                        key={k}
                        label={
                          {
                            start_time: "Start",
                            end_time: "End",
                            cutoff_time: "Response cutoff",
                          }[k]
                        }
                      >
                        <input
                          type="time"
                          required
                          value={w[k]}
                          onChange={(e) =>
                            setDraft(
                              values.map((m, j) =>
                                i === j ? { ...m, [k]: e.target.value } : m,
                              ),
                            )
                          }
                        />
                      </Field>
                    ),
                  )}
                </div>
                <div className="divider" />
              </div>
            ))}
            <small>
              Meal windows must not overlap. The response cutoff must be at or
              before the meal start.
            </small>
            <Button disabled={action.busy}>Save meal settings</Button>
          </form>
        )
      )}
    </div>
  );
}
export function SystemSettings({ isAdmin }: { isAdmin: boolean }) {
  const remote = useRemote<Settings>("/admin/settings"),
    action = useAction(),
    [draft, setDraft] = useState<Settings | null>(null),
    [admin, setAdmin] = useState({
      name: "",
      email: "",
      password: "",
      role: "MESS_ADMIN",
    });
  const values = draft ?? remote.data;
  return (
    <div className="stack">
      <Heading
        title="Your campus, your assumptions"
        description="Keep cost and environmental estimates explicit and reviewable."
        actions={
          <Link href="/admin/settings/meals" className="btn secondary">
            Meal windows
          </Link>
        }
      />
      <Feedback action={action} />
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        values && (
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api.request("/admin/settings", {
                  method: "PUT",
                  body: values,
                });
                await remote.reload();
              });
            }}
          >
            <h3>Cost, waste and environmental factors</h3>
            <div className="fields">
              {(
                [
                  ["costPerKg", "Food cost per kg (₹)"],
                  [
                    "baselineWastePerStudent",
                    "Baseline waste per check-in (kg)",
                  ],
                  ["co2PerKg", "Estimated CO₂e per kg of food (kg)"],
                  [
                    "waterLitresPerKg",
                    "Estimated water per kg of food (litres)",
                  ],
                  ["portionKg", "Food requirement per attendee (kg)"],
                  [
                    "onlineThresholdMinutes",
                    "Device online threshold (minutes)",
                  ],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    disabled={!isAdmin}
                    min={key === "onlineThresholdMinutes" ? 1 : 0}
                    step={key === "onlineThresholdMinutes" ? 1 : "any"}
                    value={values[key] ?? ""}
                    placeholder="Not configured"
                    onChange={(e) =>
                      setDraft({
                        ...values,
                        [key]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <small>
              Leave optional assumptions blank until you have a defensible
              baseline. Environmental results are estimates. Only administrators
              can change these settings.
            </small>
            {isAdmin && (
              <Button disabled={action.busy}>Save assumptions</Button>
            )}
          </form>
        )
      )}
      {isAdmin && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.request("/admin/administrators", {
                method: "POST",
                body: admin,
              });
              setAdmin({
                name: "",
                email: "",
                password: "",
                role: "MESS_ADMIN",
              });
            }, "Administrator account created.");
          }}
        >
          <h3>Create administrator access</h3>
          <div className="fields">
            <Field label="Name">
              <input
                required
                minLength={2}
                value={admin.name}
                onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
              />
            </Field>
            <Field label="Initial password (12+ characters)">
              <input
                required
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={admin.password}
                onChange={(e) =>
                  setAdmin({ ...admin, password: e.target.value })
                }
              />
            </Field>
            <Field label="Role">
              <select
                value={admin.role}
                onChange={(e) => setAdmin({ ...admin, role: e.target.value })}
              >
                <option value="MESS_ADMIN">Mess manager</option>
                <option value="ADMIN">Full administrator</option>
              </select>
            </Field>
          </div>
          <Button disabled={action.busy}>Create administrator</Button>
        </form>
      )}
    </div>
  );
}
export function AuditPage() {
  const [p, setP] = useState(1);
  const remote = useRemote<Page<Audit>>("/admin/audit-logs?page=" + p);
  return (
    <div className="stack">
      <Heading
        title="A record of important changes"
        description="Operational changes are attributed to an actor and retained for review."
      />
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <ErrorBox message={remote.error} />
      ) : (
        remote.data && (
          <div className="card table-card">
            <Table
              rows={remote.data.items}
              columns={[
                {
                  key: "created_at",
                  label: "Time (IST)",
                  render: (r) => timestamp(r.created_at),
                },
                { key: "actor_email", label: "Actor" },
                { key: "actor_role", label: "Role" },
                { key: "action", label: "Action" },
                { key: "entity", label: "Entity" },
                {
                  key: "metadata",
                  label: "Details",
                  render: (r) => (
                    <span
                      style={{
                        display: "block",
                        maxWidth: 400,
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(r.metadata)}
                    </span>
                  ),
                },
              ]}
            />
            <Pager {...remote.data} onChange={setP} />
          </div>
        )
      )}
    </div>
  );
}
