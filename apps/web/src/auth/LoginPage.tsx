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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900">Калькулятор заказов</h1>
      <p className="mt-2 text-sm text-stone-600">Войдите, чтобы видеть заказы и расчёты.</p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          Email
          <input
            className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-stone-700">
          Пароль
          <input
            className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="min-h-11 rounded-xl bg-emerald-900 px-4 text-base font-medium text-white disabled:opacity-60"
          type="submit"
          disabled={submitting || Boolean(configError)}
        >
          {submitting ? "Вход…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
