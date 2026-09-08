import { notFound } from "next/navigation";
import { AdminView } from "../../../components/admin-view";
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const p = await params;
  const section = p.section?.join("/") || "dashboard";
  if (
    ![
      "dashboard",
      "students",
      "attendance",
      "fingerprints",
      "waste",
      "predictions",
      "reports",
      "devices",
      "audit-logs",
      "settings",
      "settings/meals",
    ].includes(section)
  )
    notFound();
  return <AdminView section={section} />;
}
