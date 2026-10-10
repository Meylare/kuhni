import { useAuth } from "./AuthProvider";

export function AccessDeniedPage() {
  const { session, signOut } = useAuth();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-4 bg-[#f6f1ea]">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-sm border border-stone-200 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-bold text-stone-900">Нет доступа</h1>
        <p className="text-sm text-stone-600">
          Учётная запись{" "}
          <strong className="text-stone-800 break-all">
            {session?.user.email ?? "пользователя"}
          </strong>{" "}
          не имеет прав владельца (роль{" "}
          <code className="text-stone-700 bg-stone-100 px-1 py-0.5 rounded font-mono text-xs">
            owner
          </code>
          ).
        </p>
        <p className="text-xs text-stone-500">
          Для получения доступа обратитесь к администратору системы.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-700 transition"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </main>
  );
}
