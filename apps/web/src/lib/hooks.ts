"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import { onAuthChange, signInWithGoogle, signOut, setSessionCookie, clearSessionCookie, handleRedirectResult, type User } from "./firebase";
import { fetcher, api } from "./api";

// ──────────────────────────────────────────────
// Auth Hook
// ──────────────────────────────────────────────

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Handle redirect result from Google sign-in
    handleRedirectResult().catch(() => {});

    const unsubscribe = onAuthChange(async (user) => {
      setUser(user);
      if (user) {
        await setSessionCookie(user);
      } else {
        clearSessionCookie();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = useCallback(async () => {
    try {
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      clearSessionCookie();
      await signOut();
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  return { user, loading, error, signIn: handleSignIn, signOut: handleSignOut };
}

// ──────────────────────────────────────────────
// Organization Context
// ──────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "enterprise";
  memberCount: number;
}

interface OrgContextValue {
  currentOrg: Organization | null;
  orgs: Organization[];
  switchOrg: (orgId: string) => void;
  loading: boolean;
}

export const OrgContext = createContext<OrgContextValue>({
  currentOrg: null,
  orgs: [],
  switchOrg: () => {},
  loading: true,
});

export function useOrg(): OrgContextValue {
  return useContext(OrgContext);
}

export function useOrgProvider(): OrgContextValue {
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  // Mock orgs for now - replace with API call
  const orgs: Organization[] = [
    {
      id: "org_1",
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "enterprise",
      memberCount: 42,
    },
    {
      id: "org_2",
      name: "Demo Org",
      slug: "demo-org",
      plan: "pro",
      memberCount: 8,
    },
  ];

  const currentOrg = orgs.find((o) => o.id === currentOrgId) || orgs[0] || null;

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
  }, []);

  return { currentOrg, orgs, switchOrg, loading: false };
}

// ──────────────────────────────────────────────
// API / SWR Hooks
// ──────────────────────────────────────────────

export function useApi<T>(path: string | null, config?: SWRConfiguration) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    path,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...config,
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}

export function useApiMutation<TInput, TOutput = unknown>(path: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const trigger = useCallback(
    async (data: TInput, method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST"): Promise<TOutput | undefined> => {
      setLoading(true);
      setError(null);
      try {
        let result: TOutput;
        switch (method) {
          case "POST":
            result = await api.post<TOutput>(path, data);
            break;
          case "PUT":
            result = await api.put<TOutput>(path, data);
            break;
          case "PATCH":
            result = await api.patch<TOutput>(path, data);
            break;
          case "DELETE":
            result = await api.delete<TOutput>(path);
            break;
        }
        return result;
      } catch (err) {
        setError(err as Error);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [path]
  );

  return { trigger, loading, error };
}

// ──────────────────────────────────────────────
// Debounce
// ──────────────────────────────────────────────

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
