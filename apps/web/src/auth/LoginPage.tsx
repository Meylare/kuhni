import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { signIn, configError, enterDemoMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(configError);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configError) {
      setError(configError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setError(message);
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-[#09090b] px-5 py-10 text-zinc-100 select-none">
      <div className="w-full max-w-[380px] flex flex-col">
        {/* Заголовок */}
        <div className="pb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
              Система расчёта мебели
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Вход в систему
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Рабочая база заказов, прайс-листа и калькуляций
          </p>
        </div>

        {/* Основная форма входа владельца (реальная БД Supabase) */}
        <form className="py-6 flex flex-col gap-4 border-b border-white/[0.08]" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
            Электронная почта
            <input
              className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-white/30 transition-colors"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="owner@example.com"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
            Пароль
            <input
              className="h-11 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-white/30 transition-colors"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && (
            <p className="border-l-2 border-rose-500 bg-rose-500/5 pl-3 py-2 text-xs text-rose-300" role="alert">
              {error}
            </p>
          )}

          <button
            className="mt-1 flex h-11 items-center justify-center rounded-xl bg-white text-black px-4 text-[14px] font-semibold hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            type="submit"
            disabled={submitting || Boolean(configError)}
          >
            {submitting ? "Вход…" : "Войти"}
          </button>
        </form>

        {/* Второстепенная кнопка демо-режима */}
        <div className="pt-5 flex items-center justify-between text-[12px] text-zinc-500">
          <span>Нет доступа к аккаунту?</span>
          <button
            type="button"
            onClick={enterDemoMode}
            className="text-zinc-300 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
          >
            Открыть демо-режим →
          </button>
        </div>
      </div>
    </main>
  );
}
