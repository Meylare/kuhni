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
            Калькуляция себестоимости, маржи и спецификаций
          </p>
        </div>

        {/* Быстрый запуск интерактивного демо */}
        <div className="py-6 border-b border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-white">
              Интерактивный демо-режим
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">
              Без пароля
            </span>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed mb-4">
            Готовые заказы кухонь и шкафов, тактильная шкала цены, голосовой ввод и живой пересчёт маржи.
          </p>
          <button
            type="button"
            onClick={enterDemoMode}
            className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-zinc-200 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>Открыть демо-стенд</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Форма входа владельца */}
        <form className="pt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Рабочий аккаунт
          </span>

          <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
            Электронная почта
            <input
              className="h-10 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-white/30 transition-colors"
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

          <label className="flex flex-col gap-1.5 text-xs text-zinc-400">
            Пароль
            <input
              className="h-10 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-white/30 transition-colors"
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
            className="mt-1 flex h-10 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 text-[13px] font-medium text-white hover:bg-white/[0.1] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            type="submit"
            disabled={submitting || Boolean(configError)}
          >
            {submitting ? "Проверка…" : "Войти"}
          </button>
        </form>
      </div>
    </main>
  );
}
