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
    <main className="relative flex min-h-svh w-full items-center justify-center bg-[#fbfaf7] px-4 py-8">
      {/* Мягкие фоновые акцентные градиенты */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-100/50 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-stone-200/80 bg-white/95 p-6 shadow-xl backdrop-blur-md sm:p-8">
        {/* Шапка */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-900 text-xl font-bold text-white shadow-md shadow-emerald-950/20">
            К
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-stone-900">
                Калькулятор 2.0
              </h1>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                UX PRO
              </span>
            </div>
            <p className="text-xs text-stone-500">Система расчёта кухонь и корпусной мебели</p>
          </div>
        </div>

        {/* Быстрый Демо-вход для тестирования без паролей */}
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <span>✨</span>
              <span>Тест-драйв нового интерфейса</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Рекомендуется
            </span>
          </div>
          <p className="text-xs text-emerald-900/80 leading-relaxed">
            Полистайте готовые кухни, попробуйте быстрый ввод материалов и живой расчет маржи прямо сейчас.
          </p>
          <button
            type="button"
            onClick={enterDemoMode}
            className="mt-3 flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-950 active:scale-98 transition-all cursor-pointer"
          >
            <span>⚡ Войти в Демо-режим</span>
            <span className="text-xs opacity-80">(без пароля)</span>
          </button>
        </div>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <span className="relative bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            или вход владельца
          </span>
        </div>

        {/* Форма авторизации Supabase */}
        <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-700">
            Email
            <input
              className="min-h-11 rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 text-sm text-stone-900 outline-none focus:border-emerald-800 focus:bg-white transition-colors"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="owner@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-stone-700">
            Пароль
            <input
              className="min-h-11 rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 text-sm text-stone-900 outline-none focus:border-emerald-800 focus:bg-white transition-colors"
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
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
              {error}
            </p>
          )}

          <button
            className="mt-1 flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-50 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
            type="submit"
            disabled={submitting || Boolean(configError)}
          >
            {submitting ? "Проверка…" : "Войти в рабочий аккаунт"}
          </button>
        </form>
      </div>
    </main>
  );
}
