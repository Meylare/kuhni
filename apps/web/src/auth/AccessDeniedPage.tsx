import { useAuth } from "./AuthProvider";

export function AccessDeniedPage() {
  const { session, signOut } = useAuth();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-4 bg-[#09090b] text-zinc-100">
      <div className="w-full max-w-md rounded-3xl bg-[#141418] p-6 sm:p-8 shadow-2xl border border-white/10 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Нет доступа</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Учётная запись{" "}
          <strong className="text-white break-all">
            {session?.user.email ?? "пользователя"}
          </strong>{" "}
          не имеет прав владельца (роль{" "}
          <code className="text-amber-300 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-md font-mono text-[11px]">
            owner
          </code>
          ).
        </p>
        <p className="text-xs text-zinc-500">
          Для получения доступа обратитесь к администратору системы.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full min-h-11 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer shadow-md"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </main>
  );
}
