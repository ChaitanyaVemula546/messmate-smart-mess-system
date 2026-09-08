"use client";
import type { ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Button, ErrorBox } from "./ui";
export function Heading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading between">
      <div>
        <span className="eyebrow">Campus dining · Asia/Kolkata</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="row no-print">{actions}</div>
    </div>
  );
}
export function Feedback({
  action,
}: {
  action: { message: string; error: string };
}) {
  return (
    <>
      {action.error && <ErrorBox message={action.error} />}{" "}
      {action.message && (
        <div className="notice" role="status">
          {action.message}
        </div>
      )}
    </>
  );
}
export function Export({
  kind,
  from,
  to,
}: {
  kind: string;
  from?: string;
  to?: string;
}) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return (
    <a
      href={`/api/admin/export/${kind}?${q}`}
      className="btn secondary no-print"
    >
      <Download size={15} />
      Export CSV
    </a>
  );
}
export function Retry({
  error,
  reload,
}: {
  error: string;
  reload: () => void;
}) {
  return (
    <>
      <ErrorBox message={error} />
      <Button variant="secondary" onClick={reload}>
        <RefreshCw size={15} />
        Retry
      </Button>
    </>
  );
}
