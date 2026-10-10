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

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(config.ok);

  useEffect(() => {
    if (!config.ok) {
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [config.ok]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      configError: config.ok ? null : config.reason,
      signIn: async (email, password) => {
        const { error } = await getSupabase().auth.signInWithPassword({
          email,
          password,
        });
        return error ? mapAuthError(error.message) : null;
      },
      signOut: async () => {
        await getSupabase().auth.signOut();
        await clearAllCaches();
      },
    }),
    [config, loading, session],
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
