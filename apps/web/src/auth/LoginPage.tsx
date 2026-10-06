import { useState, type FormEvent } from "react";

import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { signIn, configError } = useAuth();
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
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900 text-lg font-bold text-white shadow-xs">
          К
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 leading-tight">
            Калькулятор заказов
          </h1>
          <p className="text-xs text-stone-500">v1 • Кухни и корпусная мебель</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-stone-600">Войдите, чтобы видеть заказы и расчёты.</p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-stone-700">
          Email
          <input
            className="min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 text-sm text-stone-900 outline-none focus:border-emerald-800"
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
            className="min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 text-sm text-stone-900 outline-none focus:border-emerald-800"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="min-h-11 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white shadow-xs hover:bg-emerald-950 active:scale-98 transition-all disabled:opacity-60"
          type="submit"
          disabled={submitting || Boolean(configError)}
        >
          {submitting ? "Вход…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
