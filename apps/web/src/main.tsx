import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { reloadClearingSwCaches } from "./components/ErrorBoundary.tsx";
import "./index.css";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const key = "kuhni_preload_reload_ts";
  const last = Number(sessionStorage.getItem(key) || "0");
  if (Date.now() - last > 15_000) {
    sessionStorage.setItem(key, String(Date.now()));
    void reloadClearingSwCaches();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
