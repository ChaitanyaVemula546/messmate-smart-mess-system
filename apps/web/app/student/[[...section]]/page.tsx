import { notFound } from "next/navigation";
import { StudentView } from "../../../components/student-view";
export default async function StudentPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const p = await params;
  const section = p.section?.join("/") || "dashboard";
  if (!["dashboard", "meals", "history", "profile"].includes(section))
    notFound();
  return <StudentView section={section} />;
}
