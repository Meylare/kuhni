# Веб-интерфейс калькулятора заказов (`@kuhni/web`)

Интерфейс калькулятора мебели (React + Vite + Tailwind CSS + Supabase JS + PWA).

## Запуск в разработке

1. Скопируйте `.env.example` в `apps/web/.env` и укажите публичные переменные:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   > **Важно:** использовать только публичный anon-ключ, `service_role` в интерфейсе запрещён.

2. Запустите dev-сервер:
   ```bash
   npm run dev
   ```

## Сборка и тесты

```bash
npm test
npm run build
```
