import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { createApiClient, ApiError } from "@messmate/api-client";
import type { User } from "@messmate/types";
const KEY = "messmate.session";
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:4000/api";
export const api = createApiClient(API_BASE, () =>
  SecureStore.getItemAsync(KEY),
);
interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      const token = await SecureStore.getItemAsync(KEY);
      if (token) {
        const u = await api.request<User>("/auth/session");
        if (u.role !== "STUDENT")
          throw new Error(
            "This app is for students. Administrators use the website.",
          );
        setUser(u);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await SecureStore.deleteItemAsync(KEY);
        setUser(null);
      } else
        setError(
          e instanceof Error ? e.message : "Could not connect to MessMate.",
        );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const login = async (email: string, password: string) => {
    const result = await api.request<{ user: User; token: string }>(
      "/auth/login",
      { method: "POST", body: { email, password } },
    );
    if (result.user.role !== "STUDENT") {
      const temporary = createApiClient(API_BASE, async () => result.token);
      await temporary.request("/auth/logout", { method: "POST", body: {} });
      throw new Error(
        "This app is for students. Administrators use the website.",
      );
    }
    await SecureStore.setItemAsync(KEY, result.token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setUser(result.user);
  };
  const logout = async () => {
    try {
      await api.request("/auth/logout", { method: "POST", body: {} });
    } finally {
      await SecureStore.deleteItemAsync(KEY);
      setUser(null);
    }
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, refresh, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider missing");
  return context;
}
