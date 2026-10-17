import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "../lib/config";
import { getSupabase } from "../lib/supabase";
import { clearAllCaches } from "../lib/cache";
import { isDemoModeActive, setDemoModeActive } from "../lib/demo-data";

export type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  isOwner: boolean | null;
  checkingRole: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login") || lower.includes("invalid_credentials")) {
    return "Неверный email или пароль";
  }
  if (lower.includes("email")) {
    return "Проверьте email";
  }
  return "Не удалось войти. Попробуйте ещё раз.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const config = getPublicSupabaseConfig();
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => isDemoModeActive());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(config.ok);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(false);

  useEffect(() => {
    if (!config.ok) {
      setLoading(false);
      if (isDemoMode) {
        setIsOwner(true);
      }
      return;
    }

    const supabase = getSupabase();

    async function checkRole(activeSession: Session | null) {
      if (!activeSession) {
        setIsOwner(isDemoMode ? true : null);
        setCheckingRole(false);
        return;
      }
      // Если есть реальная сессия Supabase — всегда используем реальную базу данных
      if (isDemoMode) {
        setDemoModeActive(false);
        setIsDemoMode(false);
      }
      setCheckingRole(true);
      try {
        const { data, error } = await supabase.rpc("is_owner");
        if (error) {
          console.error("Ошибка проверки роли is_owner:", error);
          setIsOwner(false);
        } else {
          setIsOwner(Boolean(data));
        }
      } catch (err) {
        console.error("Исключение при проверке is_owner:", err);
        setIsOwner(false);
      } finally {
        setCheckingRole(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      void checkRole(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void checkRole(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [config.ok, isDemoMode]);

  const enterDemoMode = () => {
    setDemoModeActive(true);
    setIsDemoMode(true);
    setIsOwner(true);
    setLoading(false);
  };

  const exitDemoMode = () => {
    setDemoModeActive(false);
    setIsDemoMode(false);
    setIsOwner(session ? true : null);
    setLoading(false);
  };

  const demoSession = useMemo<Session | null>(() => {
    if (!isDemoMode) return null;
    return {
      access_token: "demo-token",
      refresh_token: "demo-refresh",
      expires_in: 999999,
      token_type: "bearer",
      user: {
        id: "demo-owner",
        app_metadata: {},
        user_metadata: { name: "Демо-режим" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
        email: "demo@kuhni.kz",
      },
    } as unknown as Session;
  }, [isDemoMode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: session ?? (isDemoMode ? demoSession : null),
      loading: isDemoMode && !session ? false : loading,
      isOwner: session ? isOwner : isDemoMode ? true : isOwner,
      checkingRole: session ? checkingRole : false,
      configError: isDemoMode ? null : config.ok ? null : config.reason,
      isDemoMode: !session && isDemoMode,
      enterDemoMode,
      exitDemoMode,
      signIn: async (email, password) => {
        setDemoModeActive(false);
        setIsDemoMode(false);
        const { error } = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });
        return error ? mapAuthError(error.message) : null;
      },
      signOut: async () => {
        if (isDemoMode && !session) {
          exitDemoMode();
          return;
        }
        setDemoModeActive(false);
        setIsDemoMode(false);
        await getSupabase().auth.signOut();
        setIsOwner(null);
        await clearAllCaches();
      },
    }),
    [config, loading, session, isOwner, checkingRole, isDemoMode, demoSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth должен вызываться внутри AuthProvider");
  }
  return value;
}
