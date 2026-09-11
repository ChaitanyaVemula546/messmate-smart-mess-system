"use client";
import { RefreshCw } from "lucide-react";
import type { FingerprintInventoryRow, Page } from "@messmate/types";
import { Retry } from "./admin-common";
import { Badge, Button, Empty, Loading, Pager, Table, timestamp } from "./ui";

export function SensorInventory({
  remote,
  onPageChange,
  onAssign,
}: {
  remote: {
    data: Page<FingerprintInventoryRow> | null;
    error: string;
    loading: boolean;
    reload: () => Promise<void>;
  };
  onPageChange: (page: number) => void;
  onAssign: (row: FingerprintInventoryRow) => void;
}) {
  return (
    <section className="stack" aria-labelledby="sensor-inventory-title">
      <div className="between">
        <div>
          <h2 id="sensor-inventory-title">Fingerprints on your sensors</h2>
          <small>Sensor reports and assignments refresh every 10 seconds.</small>
        </div>
        <Button
          variant="secondary"
          disabled={remote.loading}
          onClick={() => void remote.reload()}
        >
          <RefreshCw size={15} />
          Refresh sensor IDs
        </Button>
      </div>
      <div className="notice">
        Enroll a finger through the ESP32 Serial Monitor. Its ID appears here
        after the scanner syncs. Create or select the student, then assign that
        ID. Fingerprint templates stay on the R307 sensor.
      </div>
      {remote.loading ? (
        <Loading />
      ) : remote.error ? (
        <Retry error={remote.error} reload={remote.reload} />
      ) : (
        remote.data && (
          <div className="card table-card">
            {remote.data.items.length ? (
              <Table
                rows={remote.data.items}
                columns={[
                  { key: "fingerprint_id", label: "Fingerprint ID" },
                  {
                    key: "device_name",
                    label: "Scanner",
                    render: (row) => (
                      <div>
                        <div>{row.device_name}</div>
                        <small>{row.device_code}</small>
                      </div>
                    ),
                  },
                  {
                    key: "present",
                    label: "Sensor status",
                    render: (row) => (
                      <Badge tone={row.present ? "" : "neutral"}>
                        {row.present ? "On sensor" : "Missing from sensor"}
                      </Badge>
                    ),
                  },
                  {
                    key: "name",
                    label: "Student assignment",
                    render: (row) =>
                      row.student_id ? (
                        <div>
                          <div>{row.name}</div>
                          <small>{row.student_code} · Assigned</small>
                        </div>
                      ) : (
                        <Badge tone="neutral">Awaiting assignment</Badge>
                      ),
                  },
                  {
                    key: "last_seen",
                    label: "Last seen (IST)",
                    render: (row) => timestamp(row.last_seen),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <Button
                        variant="secondary"
                        size="small"
                        disabled={!row.present}
                        aria-label={`Assign fingerprint ${row.fingerprint_id} from ${row.device_name}`}
                        onClick={() => onAssign(row)}
                      >
                        {row.student_id ? "Change assignment" : "Assign"}
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty text="No sensor IDs reported yet. Enroll a finger and keep the scanner connected so it can sync." />
            )}
            <Pager {...remote.data} onChange={onPageChange} />
          </div>
        )
      )}
      <small>
        Missing IDs were absent from the scanner&apos;s latest sync. Enroll them
        again before assigning. Removing a student assignment does not erase the
        sensor template.
      </small>
    </section>
  );
}
