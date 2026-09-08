import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { ApiError } from "@messmate/api-client";
import { api, useAuth } from "./auth";
export function useRemote<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const auth = useAuth();
  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api.request<T>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot reach MessMate.");
      if (e instanceof ApiError && e.status === 401) await auth.refresh();
    } finally {
      setLoading(false);
    }
  }, [path, auth.refresh]);
  useEffect(() => {
    setLoading(true);
    void load();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => listener.remove();
  }, [load]);
  return { data, loading, error, reload: load };
}
