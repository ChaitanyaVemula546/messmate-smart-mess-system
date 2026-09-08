"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { X, Leaf, ChevronLeft, ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      primary: "",
      secondary: "secondary",
      danger: "danger",
      ghost: "ghost",
    },
    size: { normal: "", small: "small" },
  },
  defaultVariants: { variant: "primary", size: "normal" },
});
export function Button({
  variant = "primary",
  size = "normal",
  className,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "normal" | "small";
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <Leaf size={19} />
      </span>
      MessMate<span style={{ color: "#8cab65" }}>.</span>
    </span>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay" />
        <DialogPrimitive.Content className="dialog">
          <DialogPrimitive.Title asChild>
            <h2>{title}</h2>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="muted">
            {description ?? "Review the details before saving."}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close className="close" aria-label="Close dialog">
            <X size={18} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Empty({
  text = "No records yet. New activity will appear here.",
}: {
  text?: string;
}) {
  return <div className="empty">{text}</div>;
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="error">
      {message}
    </div>
  );
}
export function Loading() {
  return (
    <div className="stack" aria-label="Loading" role="status">
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function Table<T extends object>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { key: string; label: string; render?: (row: T) => ReactNode }[];
}) {
  if (!rows.length) return <Empty />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String((row as Record<string, unknown>).id ?? i)}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render
                    ? c.render(row)
                    : display((row as Record<string, unknown>)[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function display(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "")
    return <span className="muted">—</span>;
  if (typeof value === "boolean")
    return (
      <Badge tone={value ? "" : "neutral"}>
        {value ? "Present" : "Not recorded"}
      </Badge>
    );
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
export function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : "0 records"}
      </span>
      <div className="row">
        <Button
          aria-label="Previous page"
          variant="secondary"
          size="small"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={14} />
        </Button>
        <span>Page {page}</span>
        <Button
          aria-label="Next page"
          variant="secondary"
          size="small"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
export function Kpi({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-label">
        {label}
        {icon}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-note">{note ?? "From recorded activity"}</div>
    </div>
  );
}
export const number = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined
    ? "Not configured"
    : new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(
        v,
      );
export const timestamp = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
