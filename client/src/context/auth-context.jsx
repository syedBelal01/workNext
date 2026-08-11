"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  ApiError,
  clearToken,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
} from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedUser());
  const [loading, setLoading] = useState(() => Boolean(getToken()) && !getCachedUser());

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setCachedUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await api.get("/auth/me", undefined, { skipCache: true });
      setUser(me);
      setCachedUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Instant UI from cache, then quietly revalidate
    if (getToken()) {
      if (getCachedUser()) setLoading(false);
      refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    setToken(data.token);
    setUser(data.user);
    setCachedUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      if (!(error instanceof ApiError)) {
        // ignore
      }
    } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...roles) => (user ? roles.includes(user.role) : false),
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasRole, refresh }),
    [user, loading, login, logout, hasRole, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
