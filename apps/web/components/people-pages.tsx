"use client";
import { FingerprintFeedback, ScannerActivity } from "./fingerprint-feedback";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Fingerprint,
  Trash2,
  History as HistoryIcon,
  KeyRound,
} from "lucide-react";
import type {
  Student,
  Page,
  HistoryRow,
  Device,
  FingerprintInventoryRow,
} from "@messmate/types";
import { api, useAction, useRemote } from "./hooks";
import {
  Button,
  Field,
  Modal,
  Table,
  Pager,
  Loading,
  Badge,
  timestamp,
  ErrorBox,
} from "./ui";
import { Heading, Feedback, Retry, Export } from "./admin-common";
import { SensorInventory } from "./sensor-inventory";
export function StudentPicker({
  value,
  onChange,
  selectedLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  selectedLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const { data, error } = useRemote<Page<Student>>(
    "/admin/students?pageSize=100&status=ACTIVE&search=" +
      encodeURIComponent(search),
  );
  return (
    <>
      <Field label="Find student">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or student ID"
        />
      </Field>
      <Field label="Student">
        <select
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose a student</option>
          {value &&
            selectedLabel &&
            !data?.items.some((student) => student.id === value) && (
              <option value={value}>{selectedLabel}</option>
            )}
          {data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.student_id} · {s.name}
            </option>
          ))}
        </select>
      </Field>
      {error && <ErrorBox message={error} />}
    </>
  );
}
const blankStudent = {
  studentId: "",
  name: "",
  registrationNumber: "",
  hostel: "",
  roomNumber: "",
  phone: "",
  email: "",
  password: "",
  status: "ACTIVE",
};
export function Students() {
  const [p, setP] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [editing, setEditing] = useState<Student | null>(null),
    [open, setOpen] = useState(false),
    [form, setForm] = useState(blankStudent),
    [history, setHistory] = useState<Student | null>(null);
  const remote = useRemote<Page<Student>>(
    `/admin/students?page=${p}&search=${encodeURIComponent(search)}&status=${status}`,
  );
  const action = useAction();
  function edit(s?: Student) {
    setEditing(s ?? null);
    setForm(
      s
        ? {
            studentId: s.student_id,
            name: s.name,
            registrationNumber: s.registration_number,
            hostel: s.hostel,
            roomNumber: s.room_number,
            phone: s.phone ?? "",
            email: s.email,
            password: "",
            status: s.status,
          }
        : blankStudent,
    );
    setOpen(true);
  }
  return (
    <div className="stack">
      <Heading
        title="The people behind every meal"
        description="Manage student accounts, campus details and access."
        actions={
          <>
            <Export kind="students" />
            <Button onClick={() => edit()}>
              <Plus size={15} />
              Add student
            </Button>
          </>
        }
      />
      <Feedback action={action} />
      <div className="toolbar">
        <Field label="Search students">
          <input
            className="control"
            type="search"
            placeholder="Name, ID or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setP(1);
            }}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setP(1);
            }}
          >
            <option value="">All students</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </Field>
      </div>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        remote.data && (
          <div className="card table-card">
            <Table
              rows={remote.data.items}
              columns={[
                { key: "student_id", label: "Student ID" },
                { key: "name", label: "Name" },
                { key: "hostel", label: "Hostel" },
                { key: "room_number", label: "Room" },
                { key: "email", label: "Email" },
                { key: "fingerprint_id", label: "Fingerprint" },
                {
                  key: "status",
                  label: "Status",
                  render: (s) => (
                    <Badge tone={s.status === "ACTIVE" ? "" : "neutral"}>
                      {s.status}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (s) => (
                    <div className="row">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => edit(s)}
                        aria-label={"Edit " + s.name}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setHistory(s)}
                        aria-label={"History for " + s.name}
                      >
                        <HistoryIcon size={13} />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
            <Pager {...remote.data} onChange={setP} />
          </div>
        )
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit student" : "Add a student"}
        description="Account and student details are saved together. Inactive accounts lose access."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const { password, ...rest } = form;
              await api.request(
                "/admin/students" + (editing ? "/" + editing.id : ""),
                {
                  method: editing ? "PUT" : "POST",
                  body: editing ? rest : { ...rest, password },
                },
              );
              setOpen(false);
              await remote.reload();
            });
          }}
        >
          <div className="fields">
            {(
              [
                ["studentId", "Student ID"],
                ["name", "Full name"],
                ["registrationNumber", "Registration number"],
                ["hostel", "Hostel"],
                ["roomNumber", "Room"],
                ["email", "Email"],
                ["phone", "Phone (optional)"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type={key === "email" ? "email" : "text"}
                  required={key !== "phone"}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </Field>
            {!editing && (
              <Field label="Initial password (12+ characters)">
                <input
                  type="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </Field>
            )}
          </div>
          {action.error && <ErrorBox message={action.error} />}
          <Button disabled={action.busy}>
            {action.busy ? "Saving…" : "Save student"}
          </Button>
        </form>
      </Modal>
      {history && (
        <HistoryModal student={history} onClose={() => setHistory(null)} />
      )}
    </div>
  );
}
function HistoryModal({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) {
  const [p, setP] = useState(1);
  const remote = useRemote<Page<HistoryRow>>(
    `/admin/students/${student.id}/history?page=${p}`,
    10000,
  );
  return (
    <Modal open onClose={onClose} title={student.name + " · history"}>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <ErrorBox message={remote.error} />
      ) : (
        remote.data && (
          <>
            <Table
              rows={remote.data.items}
              columns={[
                { key: "date", label: "Date" },
                { key: "meal", label: "Meal" },
                { key: "response", label: "Intention" },
                { key: "present", label: "Present" },
                {
                  key: "check_in_time",
                  label: "Time",
                  render: (r) =>
                    r.source === "IMPORT"
                      ? "Imported · unknown"
                      : timestamp(r.check_in_time),
                },
              ]}
            />
            <Pager {...remote.data} onChange={setP} />
          </>
        )
      )}
    </Modal>
  );
}
interface MappingRow {
  student_uuid: string;
  student_id: string;
  name: string;
  fingerprint_id: number | null;
  last_attendance: string | null;
}
export function Fingerprints() {
  const [p, setP] = useState(1),
    [inventoryPage, setInventoryPage] = useState(1),
    [search, setSearch] = useState(""),
    [mapped, setMapped] = useState(""),
    [open, setOpen] = useState(false),
    [studentId, setStudentId] = useState(""),
    [studentLabel, setStudentLabel] = useState(""),
    [fingerprintId, setFingerprintId] = useState(1),
    [remove, setRemove] = useState<MappingRow | null>(null);
  const remote = useRemote<Page<MappingRow>>(
    `/admin/fingerprints?page=${p}&search=${encodeURIComponent(search)}&mapped=${mapped}`,
    10000,
  );
  const inventory = useRemote<Page<FingerprintInventoryRow>>(
    `/admin/fingerprint-inventory?page=${inventoryPage}&pageSize=20`,
    10000,
  );
  const scannerActivity = useRemote<Device[]>("/admin/devices", 20000);
  const action = useAction();
  return (
    <div className="stack">
      <Heading
        title="Fingerprint assignments"
        description="Link an enrolled sensor ID to a student. Fingerprint images stay on the sensor."
        actions={
          <Button
            onClick={() => {
              setStudentId("");
              setStudentLabel("");
              setFingerprintId(1);
              setOpen(true);
            }}
          >
            <Fingerprint size={15} />
            Assign fingerprint
          </Button>
        }
      />
      <ScannerActivity
        devices={scannerActivity.data}
        loading={scannerActivity.loading}
        error={scannerActivity.error}
      />
      <Feedback action={action} />
      <SensorInventory
        remote={inventory}
        onPageChange={setInventoryPage}
        onAssign={(row) => {
          setStudentId(row.student_id ?? "");
          setStudentLabel(
            row.student_id ? `${row.student_code} · ${row.name}` : "",
          );
          setFingerprintId(row.fingerprint_id);
          setOpen(true);
        }}
      />
      <div>
        <h2>Student assignments</h2>
        <small>Choose an ID from the sensor inventory or enter it manually.</small>
      </div>
      <div className="toolbar">
        <Field label="Search">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setP(1);
            }}
            placeholder="Student or fingerprint ID"
          />
        </Field>
        <Field label="Mapping">
          <select
            value={mapped}
            onChange={(e) => {
              setMapped(e.target.value);
              setP(1);
            }}
          >
            <option value="">All</option>
            <option value="yes">Assigned</option>
            <option value="no">Unassigned</option>
          </select>
        </Field>
      </div>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        remote.data && (
          <div className="card table-card">
            <Table
              rows={remote.data.items}
              columns={[
                { key: "fingerprint_id", label: "Fingerprint" },
                { key: "name", label: "Student" },
                { key: "student_id", label: "Student ID" },
                {
                  key: "mapping",
                  label: "Mapping",
                  render: (r) => (
                    <Badge tone={r.fingerprint_id ? "" : "neutral"}>
                      {r.fingerprint_id ? "ASSIGNED" : "UNASSIGNED"}
                    </Badge>
                  ),
                },
                {
                  key: "last_attendance",
                  label: "Last attendance",
                  render: (r) => timestamp(r.last_attendance),
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (r) => (
                    <div className="row">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setStudentId(r.student_uuid);
                          setStudentLabel(`${r.student_id} · ${r.name}`);
                          setFingerprintId(r.fingerprint_id ?? 1);
                          setOpen(true);
                        }}
                      >
                        Assign / change
                      </Button>
                      {r.fingerprint_id && (
                        <Button
                          variant="ghost"
                          size="small"
                          aria-label={"Remove mapping for " + r.name}
                          onClick={() => setRemove(r)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <Pager {...remote.data} onChange={setP} />
          </div>
        )
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Assign a fingerprint"
        description="To move an ID to another student, remove its current assignment first."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.request("/admin/fingerprints", {
                method: "PUT",
                body: { studentId, fingerprintId },
              });
              setOpen(false);
              await Promise.all([remote.reload(), inventory.reload()]);
            });
          }}
        >
          <StudentPicker
            value={studentId}
            selectedLabel={studentLabel}
            onChange={(value) => {
              setStudentId(value);
              setStudentLabel("");
            }}
          />
          <Field label="Enrolled fingerprint ID (1–1000)">
            <input
              required
              type="number"
              min={1}
              max={1000}
              value={fingerprintId}
              onChange={(e) => setFingerprintId(Number(e.target.value))}
            />
          </Field>
          {(action.busy || action.error) && (
            <FingerprintFeedback
              state={action.error ? "error" : "scanning"}
              message={action.error || "Saving fingerprint assignment…"}
              detail={
                action.error
                  ? "The assignment was not saved. Review the enrolled ID and student."
                  : "Checking this assignment with MessMate."
              }
            />
          )}
          <Button disabled={action.busy}>Save assignment</Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(remove)}
        onClose={() => setRemove(null)}
        title="Remove this mapping?"
        description={
          remove
            ? `This removes ${remove.name}'s server assignment. It does not erase the sensor template.`
            : ""
        }
      >
        <Button
          variant="danger"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api.request("/admin/fingerprints/" + remove!.student_uuid, {
                method: "DELETE",
              });
              setRemove(null);
              await Promise.all([remote.reload(), inventory.reload()]);
            }, "Fingerprint mapping removed.")
          }
        >
          Remove mapping
        </Button>
      </Modal>
    </div>
  );
}
export function Devices() {
  const remote = useRemote<Device[]>("/admin/devices", 20000),
    action = useAction();
  const [open, setOpen] = useState(false),
    [token, setToken] = useState(""),
    [confirm, setConfirm] = useState<{
      device: Device;
      rotate: boolean;
    } | null>(null),
    [form, setForm] = useState({
      deviceId: "",
      name: "",
      type: "FINGERPRINT_SCANNER",
      capacityKg: 20,
      firmwareVersion: "",
    });
  return (
    <div className="stack">
      <Heading
        title="Connected to the dining hall"
        description="Manage the R307 fingerprint scanners used for attendance. Manual food waste does not require a device."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} />
            Add device
          </Button>
        }
      />
      <Feedback action={action} />
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        remote.data && (
          <div className="card table-card">
            <Table
              rows={remote.data.filter((d) => d.type === "FINGERPRINT_SCANNER")}
              columns={[
                { key: "name", label: "Device" },
                { key: "device_id", label: "Identifier" },
                { key: "type", label: "Type" },
                {
                  key: "online",
                  label: "Connection",
                  render: (d) => (
                    <Badge tone={d.online ? "" : "neutral"}>
                      {d.status === "DISABLED"
                        ? "DISABLED"
                        : d.online
                          ? "ONLINE"
                          : "OFFLINE"}
                    </Badge>
                  ),
                },
                {
                  key: "last_seen",
                  label: "Last seen (IST)",
                  render: (d) => timestamp(d.last_seen),
                },
                { key: "last_result", label: "Last request" },
                { key: "firmware_version", label: "Firmware" },
                {
                  key: "actions",
                  label: "Actions",
                  render: (d) => (
                    <div className="row">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setConfirm({ device: d, rotate: false })}
                      >
                        {d.status === "ACTIVE" ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setConfirm({ device: d, rotate: true })}
                      >
                        <KeyRound size={13} />
                        Rotate
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Provision a device"
        description="A new token is shown once. Copy it securely to the device configuration."
      >
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const r = await api.request<{ token: string }>("/admin/devices", {
                method: "POST",
                body: form,
              });
              setToken(r.token);
              setOpen(false);
              await remote.reload();
            }, "Device created.");
          }}
        >
          <Field label="Device identifier">
            <input
              required
              pattern="[A-Za-z0-9_-]{2,60}"
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
              placeholder="SCANNER_01"
            />
          </Field>
          <Field label="Display name">
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <p className="muted">Device type: Fingerprint scanner</p>
          <div className="fields">
            <Field label="Firmware version">
              <input
                value={form.firmwareVersion}
                onChange={(e) =>
                  setForm({ ...form, firmwareVersion: e.target.value })
                }
              />
            </Field>
          </div>
          {action.error && <ErrorBox message={action.error} />}
          <Button disabled={action.busy}>Create device</Button>
        </form>
      </Modal>
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={
          confirm?.rotate
            ? "Rotate device credential?"
            : "Change device access?"
        }
        description={
          confirm?.rotate
            ? "The old credential will stop working immediately."
            : "This changes whether the device can submit readings."
        }
      >
        <Button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              const d = confirm!;
              const r = await api.request<{ token?: string }>(
                "/admin/devices/" + d.device.id,
                {
                  method: "PATCH",
                  body: d.rotate
                    ? { rotate: true }
                    : {
                        status:
                          d.device.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                      },
                },
              );
              setConfirm(null);
              if (r.token) setToken(r.token);
              await remote.reload();
            })
          }
        >
          Confirm change
        </Button>
      </Modal>
      <Modal
        open={Boolean(token)}
        onClose={() => setToken("")}
        title="Save your device token"
        description="This is the only time this credential will be shown. Keep it private."
      >
        <p className="secret">{token}</p>
        <Button onClick={() => setToken("")}>I have saved the token</Button>
      </Modal>
    </div>
  );
}
