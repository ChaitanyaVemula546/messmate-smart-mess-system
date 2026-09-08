"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Fingerprint,
  Scale,
  ChartNoAxesCombined,
  FileText,
  Radio,
  Settings,
  ClipboardList,
  CalendarDays,
  UserRound,
  LogOut,
  Menu,
  X,
  Leaf,
} from "lucide-react";
import type { User } from "@messmate/types";
import { useRemote, api } from "./hooks";
import { Logo, Loading, ErrorBox, Button, Badge } from "./ui";
const adminNav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["attendance", "Attendance", ClipboardList],
  ["students", "Students", Users],
  ["fingerprints", "Fingerprints", Fingerprint],
  ["waste", "Food waste", Scale],
  ["predictions", "Predictions", ChartNoAxesCombined],
  ["reports", "Reports", FileText],
  ["devices", "Devices", Radio],
  ["audit-logs", "Audit trail", ClipboardList],
  ["settings", "Settings", Settings],
] as const;
const studentNav = [
  ["dashboard", "My meals", LayoutDashboard],
  ["history", "My history", CalendarDays],
  ["profile", "My profile", UserRound],
] as const;
export function Shell({
  area,
  children,
}: {
  area: "admin" | "student";
  children: (u: User) => React.ReactNode;
}) {
  const { data: u, error, loading } = useRemote<User>("/auth/session"),
    [open, setOpen] = useState(false),
    [logoutError, setLogoutError] = useState("");
  const path = usePathname();
  if (loading)
    return (
      <div className="content">
        <Loading />
      </div>
    );
  if (error)
    return (
      <div className="content">
        <ErrorBox message={error} />
        <Link href="/login" className="btn">
          Sign in
        </Link>
      </div>
    );
  if (!u) return null;
  if (
    (area === "admin" && u.role === "STUDENT") ||
    (area === "student" && u.role !== "STUDENT")
  )
    return (
      <div className="content">
        <h1>Access restricted</h1>
        <Link
          className="btn"
          href={
            u.role === "STUDENT" ? "/student/dashboard" : "/admin/dashboard"
          }
        >
          Open your dashboard
        </Link>
      </div>
    );
  const nav = area === "admin" ? adminNav : studentNav;
  return (
    <div className="workspace">
      {open && (
        <button
          aria-label="Close navigation"
          className="overlay mobile-menu"
          onClick={() => setOpen(false)}
          style={{ zIndex: 45 }}
        />
      )}
      <aside className={"sidebar " + (open ? "open" : "")}>
        <Link href="/">
          <Logo />
        </Link>
        <span className="label">
          {area === "admin" ? "CAMPUS OPERATIONS" : "STUDENT PORTAL"}
        </span>
        <nav aria-label="Main navigation">
          {nav
            .filter(([key]) => key !== "audit-logs" || u.role === "ADMIN")
            .map(([key, label, Icon]) => (
              <Link
                key={key}
                href={`/${area}/${key}`}
                onClick={() => setOpen(false)}
                className={
                  path === `/${area}/${key}` ||
                  (key === "settings" && path.includes("/settings/"))
                    ? "active"
                    : ""
                }
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="row" style={{ color: "#dceac9", marginBottom: 12 }}>
            <Leaf size={17} /> Every meal matters.
          </div>
          <div>One campus. One shared system.</div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="row">
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="crumb">
              MESSMATE &nbsp; / &nbsp;{" "}
              {area === "admin" ? "ADMINISTRATION" : "STUDENT PORTAL"}
            </span>
          </div>
          <div className="row">
            <Badge tone="neutral">
              {u.role === "ADMIN"
                ? "ADMIN"
                : u.role === "MESS_ADMIN"
                  ? "MESS MANAGER"
                  : "STUDENT"}
            </Badge>
            <div className="avatar">
              {u.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <span className="name" style={{ fontSize: 12 }}>
              {u.name}
            </span>
            <Button
              variant="ghost"
              size="small"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await api.request("/auth/logout", {
                    method: "POST",
                    body: {},
                  });
                  window.location.assign("/login");
                } catch {
                  setLogoutError(
                    "Sign out failed. Check your connection and retry.",
                  );
                }
              }}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </header>
        <main className="content">
          {logoutError && <ErrorBox message={logoutError} />} {children(u)}
        </main>
      </div>
    </div>
  );
}
