"use client";
import { useCallback, useEffect, useState } from "react";
import { createApiClient, ApiError } from "@messmate/api-client";
export const api = createApiClient(
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
);
export function useRemote<T>(path: string, interval?: number) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const value = await api.request<T>(path);
      setData(value);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect.");
      if (e instanceof ApiError && e.status === 401)
        window.location.assign("/login");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    let alive = true;
    api
      .request<T>(path)
      .then((value) => {
        if (alive) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "Could not connect.");
          if (e instanceof ApiError && e.status === 401)
            window.location.assign("/login");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    const timer = interval
      ? setInterval(() => void load(), interval)
      : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [path, interval, load]);
  return { data, error, loading, reload: load };
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const run = async (
    fn: () => Promise<unknown>,
    success = "Saved successfully.",
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      setMessage(success);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, message, error, run };
}
