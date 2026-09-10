"use client";

import { createDrawable, createScope, createTimeline, stagger } from "animejs";
import { useEffect, useRef } from "react";
import { Fingerprint, Check, X } from "lucide-react";
import type { Device } from "@messmate/types";
import { canAnimate, useEntrance, useReducedMotion } from "./motion";

// State must come from the existing API or a real pending request, never a timer
// pretending a hardware scan succeeded. Device snapshots supply the last result.
export function FingerprintFeedback({
  state,
  message,
  detail,
  eventKey = message,
}: {
  state: "ready" | "scanning" | "success" | "error";
  message: string;
  detail?: string;
  eventKey?: string;
}) {
  const ref = useEntrance<HTMLDivElement>(
    eventKey,
    state === "error" ? "error" : state === "success" ? "success" : "panel",
  );
  const symbol = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (state === "ready" || reduced || !symbol.current || !canAnimate())
      return;
    const scope = createScope({ root: symbol.current }).add(() => {
      const timeline = createTimeline({
        onComplete: (instance) => instance.revert(),
      });
      const fingerprint = symbol.current!.querySelectorAll(
        ".fingerprint-lines path",
      );
      timeline.add(
        createDrawable(fingerprint, 0, 1),
        {
          draw: ["0 0", "0 1"],
          delay: stagger(35),
          duration: 650,
          ease: "inOut(3)",
        },
        0,
      );
      if (state === "scanning") {
        timeline
          .add(
            ".fingerprint-pulse",
            {
              scale: [0.85, 1.65],
              opacity: [0.65, 0],
              delay: stagger(220),
              duration: 950,
              loop: 2,
              ease: "outQuad",
            },
            0,
          )
          .add(
            ".fingerprint-beam",
            {
              y: [-15, 15],
              opacity: [0, 0.95, 0],
              duration: 1000,
              loop: 2,
              ease: "inOut(2)",
            },
            0,
          );
      } else if (state === "success") {
        timeline
          .add(
            ".fingerprint-pulse",
            {
              scale: [1, 1.8],
              opacity: [0.7, 0],
              delay: stagger(90),
              duration: 750,
              ease: "out(3)",
            },
            0,
          )
          .add(
            ".fingerprint-spark",
            {
              x: (_target: unknown, index = 0) =>
                Math.cos((index * Math.PI) / 3) * 40,
              y: (_target: unknown, index = 0) =>
                Math.sin((index * Math.PI) / 3) * 40,
              scale: [0.2, 1, 0.4],
              opacity: [0, 0.9, 0],
              duration: 760,
              ease: "out(3)",
            },
            100,
          )
          .add(
            createDrawable(
              symbol.current!.querySelectorAll(
                ".fingerprint-result polyline, .fingerprint-result path",
              ),
              0,
              1,
            ),
            { draw: ["0 0", "0 1"], duration: 430, ease: "inOut(3)" },
            200,
          );
      }
    });
    return () => scope.revert();
  }, [state, eventKey, reduced]);
  return (
    <div
      ref={ref}
      className={`fingerprint-feedback ${state}`}
      role={state === "error" ? "alert" : "status"}
      aria-atomic="true"
      data-fingerprint-state={state}
    >
      <span className="fingerprint-symbol" aria-hidden="true" ref={symbol}>
        <span className="fingerprint-pulse" />
        <span className="fingerprint-pulse" />
        <Fingerprint size={30} className="fingerprint-lines" />
        {state === "scanning" && <span className="fingerprint-beam" />}
        {state === "success" &&
          Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="fingerprint-spark" />
          ))}
        {state === "success" && (
          <span className="fingerprint-result" data-success-icon>
            <Check size={11} />
          </span>
        )}
        {state === "error" && (
          <span className="fingerprint-result">
            <X size={11} />
          </span>
        )}
      </span>
      <div>
        <strong>{message}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}

export function ScannerActivity({
  devices,
  loading,
  error,
}: {
  devices: Device[] | null;
  loading: boolean;
  error: string;
}) {
  const scanner = devices
    ?.filter((device) => device.type === "FINGERPRINT_SCANNER")
    .sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""))[0];
  let state: "ready" | "scanning" | "success" | "error" = "ready";
  let message = "No scanner activity yet";
  let detail =
    "Enabled fingerprint scanners report their latest result here. Refreshes every 20 seconds.";
  if (loading) {
    state = "scanning";
    message = "Checking scanner activity…";
  } else if (error) {
    state = "error";
    message = "Scanner activity unavailable";
    detail = error;
  } else if (scanner) {
    const result = scanner.last_result;
    if (scanner.status === "DISABLED") {
      message = "Scanner disabled";
    } else if (result === "recorded" || result === "already_recorded") {
      state = "success";
      message =
        result === "recorded"
          ? "Last scan: attendance recorded"
          : "Last scan: attendance already recorded";
    } else if (result === "authenticated") {
      state = "scanning";
      message = "Scanner request received";
    } else if (result && /^[45]\d\d$/.test(result)) {
      state = "error";
      message =
        result === "404"
          ? "Last scan rejected: fingerprint not assigned"
          : result === "409"
            ? "Last scan rejected: no active meal"
            : result === "400"
              ? "Last scan rejected: invalid fingerprint request"
              : "Last scanner request failed";
    } else {
      message = "Waiting for the scanner's first request";
    }
    const seen = scanner.last_seen
      ? new Date(scanner.last_seen).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        }) + " IST"
      : "No request received";
    detail = `${scanner.name} · ${seen} · Latest reported result, refreshed every 20 seconds.`;
  }
  return (
    <FingerprintFeedback
      state={state}
      message={message}
      detail={detail}
      eventKey={`${scanner?.id ?? "none"}-${scanner?.last_seen}-${scanner?.last_result}-${state}`}
    />
  );
}
