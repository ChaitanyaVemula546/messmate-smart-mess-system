"use client";
import { Shell } from "./shell";
import { Dashboard } from "./dashboard";
import { Students, Fingerprints, Devices } from "./people-pages";
import { AttendancePage } from "./attendance-page";
import { WastePage, Reports, Predictions } from "./analytics-pages";
import { MealSettings, SystemSettings, AuditPage } from "./settings-pages";
export function AdminView({ section }: { section: string }) {
  return (
    <Shell area="admin">
      {(u) => {
        switch (section) {
          case "students":
            return <Students />;
          case "attendance":
            return <AttendancePage isAdmin={u.role === "ADMIN"} />;
          case "fingerprints":
            return <Fingerprints />;
          case "devices":
            return <Devices />;
          case "waste":
            return <WastePage />;
          case "reports":
            return <Reports />;
          case "predictions":
            return <Predictions />;
          case "settings/meals":
            return <MealSettings />;
          case "settings":
            return <SystemSettings isAdmin={u.role === "ADMIN"} />;
          case "audit-logs":
            return <AuditPage />;
          default:
            return <Dashboard />;
        }
      }}
    </Shell>
  );
}
