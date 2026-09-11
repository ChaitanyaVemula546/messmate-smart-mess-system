"use client";
import { useState } from "react";
import { Plus, Upload, RefreshCw } from "lucide-react";
import { localClock } from "@messmate/shared";
import type { Page } from "@messmate/types";
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
  ErrorBox,
  timestamp,
} from "./ui";
import { StudentPicker } from "./people-pages";
import { MealTabs, MealPanel } from "./meal-tabs";
import { FingerprintFeedback } from "./fingerprint-feedback";
interface AttendanceRow {
  id: string;
  student_id: string;
  name: string;
  response: string | null;
  present: boolean;
  fingerprint_id: number | null;
  check_in_time: string | null;
  source: string | null;
}
export function AttendancePage({ isAdmin }: { isAdmin: boolean }) {
  const [date, setDate] = useState(localClock().date),
    [meal, setMeal] = useState("LUNCH"),
    [search, setSearch] = useState(""),
    [p, setP] = useState(1),
    [open, setOpen] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [studentId, setStudentId] = useState(""),
    [reason, setReason] = useState(""),
    [text, setText] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [importResult, setImportResult] = useState<{
      processed: number;
      successful: number;
      failed: number;
      duplicates: number;
      errors: { row: number; message: string }[];
    } | null>(null);
  const remote = useRemote<
      Page<AttendanceRow> & {
        summary: {
          expected: number;
          present: number;
          absent: number;
          unexpected: number;
        };
      }
    >(
      `/admin/attendance?date=${date}&meal=${meal}&search=${encodeURIComponent(search)}&page=${p}`,
      10000,
    ),
    action = useAction();
  const fingerprintRows =
    remote.data?.items.filter(
      (row) => row.present && row.source === "FINGERPRINT",
    ) ?? [];
  return (
    <div className="stack">
      <Heading
        title="Every arrival, accounted for"
        description="Compare student intentions with recorded attendance."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={remote.loading || refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await remote.reload();
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={15} />
              Refresh
            </Button>
            <Export kind="attendance" from={date} to={date} />
            {isAdmin && (
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload size={15} />
                Import history
              </Button>
            )}
            <Button onClick={() => setOpen(true)}>
              <Plus size={15} />
              Manual check-in
            </Button>
          </>
        }
      />
      <Feedback action={action} />
      <div className="toolbar">
        <Field label="Date">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setP(1);
            }}
          />
        </Field>
        <Field label="Search students">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setP(1);
            }}
            placeholder="Name or student ID"
          />
        </Field>
      </div>
      <MealTabs
        value={meal}
        id="attendance-meal"
        onChange={(value) => {
          setMeal(value);
          setP(1);
        }}
      />
      <MealPanel meal={meal} id="attendance-meal">
        <FingerprintFeedback
          state={
            remote.loading || refreshing
              ? "scanning"
              : remote.error
                ? "error"
                : fingerprintRows.length
                  ? "success"
                  : "ready"
          }
          message={
            remote.loading || refreshing
              ? "Checking recorded arrivals…"
              : remote.error
                ? "Attendance could not be refreshed"
                : fingerprintRows.length
                  ? "Fingerprint attendance confirmed"
                  : "Waiting for recorded fingerprint attendance"
          }
          detail={
            remote.loading || refreshing
              ? "Reading this meal's attendance from MessMate."
              : remote.error
                ? "Check the connection and retry below."
                : `${date} · ${meal.toLowerCase()} · ${fingerprintRows.length} fingerprint check-ins in this page of results. Refreshes every 10 seconds.`
          }
          eventKey={`${date}-${meal}-${p}-${refreshing}-${remote.loading}-${remote.error}-${fingerprintRows.map((row) => row.id + row.check_in_time).join("|")}`}
        />
        {remote.loading ? (
          <Loading />
        ) : remote.error ? (
          <Retry error={remote.error} reload={remote.reload} />
        ) : (
          remote.data && (
            <>
              <div className="kpi-grid">
                <Kpi label="Expected" value={remote.data.summary.expected} />
                <Kpi label="Present" value={remote.data.summary.present} />
                <Kpi
                  label="Expected, not arrived"
                  value={remote.data.summary.absent}
                />
                <Kpi
                  label="Unexpected arrivals"
                  value={remote.data.summary.unexpected}
                />
              </div>
              <div className="card table-card">
                <Table
                  rows={remote.data.items}
                  columns={[
                    { key: "student_id", label: "Student ID" },
                    { key: "name", label: "Name" },
                    { key: "response", label: "Expected response" },
                    { key: "present", label: "Attendance" },
                    { key: "fingerprint_id", label: "Fingerprint" },
                    {
                      key: "check_in_time",
                      label: "Check-in (IST)",
                      render: (r) =>
                        r.source === "IMPORT"
                          ? "Imported · time unknown"
                          : timestamp(r.check_in_time),
                    },
                    { key: "source", label: "Source" },
                  ]}
                />
                <Pager {...remote.data} onChange={setP} />
              </div>
            </>
          )
        )}
      </MealPanel>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Manual attendance"
        description={`Record ${meal.toLowerCase()} attendance for ${date}. Your reason is saved in the audit trail.`}
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.request("/admin/attendance", {
                method: "POST",
                body: { studentId, date, meal, reason },
              });
              setOpen(false);
              await remote.reload();
            }, "Attendance recorded.");
          }}
        >
          <StudentPicker value={studentId} onChange={setStudentId} />
          <Field label="Reason">
            <textarea
              minLength={5}
              maxLength={500}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          {action.error && <ErrorBox message={action.error} />}
          <Button disabled={action.busy}>Record attendance</Button>
        </form>
      </Modal>
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import historical attendance"
        description="CSV columns: date, meal, studentId, attendance. Attendance is PRESENT or ABSENT. Maximum 5,000 rows per batch."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const r = await api.request<typeof importResult>(
                "/admin/import/attendance",
                { method: "POST", body: { csv: text } },
              );
              setImportResult(r);
              await remote.reload();
            }, "Import processed. Review the row summary.");
          }}
        >
          <Field label="CSV file">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 700000) {
                    setText("");
                    return;
                  }
                  setText(await f.text());
                }
              }}
            />
          </Field>
          <Field label="CSV content">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`date,meal,studentId,attendance\n2026-09-01,LUNCH,MM1001,PRESENT`}
            />
          </Field>
          {action.error && <ErrorBox message={action.error} />}
          <Button disabled={action.busy || !text}>Validate and import</Button>
          {importResult && (
            <>
              <div className="notice">
                Processed {importResult.processed} · Successful{" "}
                {importResult.successful} · Duplicates {importResult.duplicates}{" "}
                · Failed {importResult.failed}
              </div>
              <Table
                rows={importResult.errors}
                columns={[
                  { key: "row", label: "CSV row" },
                  { key: "message", label: "Issue" },
                ]}
              />
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
