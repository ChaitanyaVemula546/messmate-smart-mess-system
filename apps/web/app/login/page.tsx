"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { User } from "@messmate/types";
import { api } from "../../components/hooks";
import { Logo, Field, Button, ErrorBox } from "../../components/ui";
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="login-page">
      <section className="login-story">
        <Link href="/">
          <Logo />
        </Link>
        <div>
          <span className="eyebrow" style={{ color: "#abc794" }}>
            A little planning goes a long way
          </span>
          <h1 className="serif">
            Good meals.
            <br />
            Better decisions.
          </h1>
          <p>Your campus dining, thoughtfully connected.</p>
        </div>
        <div className="foot row">
          <ShieldCheck size={18} />
          One account. The right access.
        </div>
      </section>
      <section className="login-form">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const { user } = await api.request<{ user: User }>(
                "/auth/login",
                { method: "POST", body: { email, password } },
              );
              window.location.assign(
                user.role === "STUDENT"
                  ? "/student/dashboard"
                  : "/admin/dashboard",
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not sign in.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <span className="eyebrow">Welcome to MessMate</span>
            <h1 style={{ margin: "15px 0 8px" }}>Sign in to your campus</h1>
            <p className="muted">
              Use the account provided by your mess administrator.
            </p>
          </div>
          {error && <ErrorBox message={error} />}
          <Field label="Email address">
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@campus.edu"
            />
          </Field>
          <Field label="Password">
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
            <ArrowRight size={16} />
          </Button>
          <small>
            Students and administrators use this secure sign-in. Your account
            determines your access.
          </small>
          <Link href="/" className="muted" style={{ fontSize: 12 }}>
            ← Back to MessMate
          </Link>
        </form>
      </section>
    </main>
  );
}
