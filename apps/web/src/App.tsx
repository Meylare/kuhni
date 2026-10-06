import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { OrdersPlaceholderPage } from "./pages/OrdersPlaceholderPage";

function Gate() {
  const { loading, session, configError } = useAuth();

  if (configError && !session) {
    return <LoginPage />;
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 text-stone-600">
        Загрузка…
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return <OrdersPlaceholderPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
