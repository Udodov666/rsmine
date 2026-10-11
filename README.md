# RSMine — платформа донатов для стримеров

Веб-платформа приёма донатов: публичная страница доната, панель управления стримера и API на Cloudflare Workers. Десктоп-программа для OBS живёт в отдельном репозитории — [rsmine-desktop](https://github.com/jdankinloh/rsmine-desktop).

**Прод:** [rsmine.ru](https://rsmine.ru) · API: `api.rsmine.ru`

## Из чего состоит

| Часть | Путь | Что это |
|---|---|---|
| **Фронтенд** | `src/`, `index.html` | Vite + React + TS: лендинг, панель управления (`#/app/...`), страница доната (`#/d/<slug>`), оверлей для OBS |
| **API-воркер** | `worker/` | Cloudflare Worker: Twitch OAuth, конфиги, релей донатов (Durable Object), TTS-прокси Cartesia |
| **Legacy-прокси** | `worker.ts`, `wrangler.toml` | Старый CORS-прокси к LZT Invoice API (оставлен для совместимости) |

Ключевые фичи: донаты по уровням с гифками, нейро-озвучка (Cartesia, 9 русских голосов), визуальные эффекты, цели сбора, фильтр слов, экспорт истории.

## Локальный запуск фронтенда

```bash
npm install
npm run dev        # http://localhost:5173
```

Без бэкенда фронт работает на mock-провайдере (данные в localStorage) — можно верстать и тестировать UI без Cloudflare.

## Сборка

### Фронтенд — production-сборка

```bash
npm run build      # → dist/
npx wrangler pages deploy dist   # деплой в Cloudflare Pages
```

Требования: Node.js 18+ и npm 9+ (зафиксировано в `package.json`).

### Десктоп-приложение — отдельный репозиторий

Сборка `RSMine-Setup-*.exe` / `RSMine-Portable.exe` живёт в репозитории [rsmine-desktop](https://github.com/Udodov666/rsmine-desktop). Там же — инструкция по самостоятельной сборке. Сам билд в этом репо (в `src/`, `dist/`) делать не нужно.

## Деплой

### Фронтенд — Cloudflare Pages

Переменные окружения Pages: `VITE_API_BASE=https://api.rsmine.ru`, `VITE_TWITCH_CLIENT_ID` (публичный client id, лежит в `.env`).

### API — Cloudflare Workers

```bash
cd worker
npm install
npx wrangler kv namespace create KV        # id → вписать в wrangler.toml
npx wrangler deploy
npx wrangler secret put TWITCH_CLIENT_ID
npx wrangler secret put TWITCH_CLIENT_SECRET
npx wrangler secret put SESSION_JWT_SECRET
```

`worker/wrangler.toml` описывает KV, Durable Object (`RelayRoom`, SQLite) и домен `api.rsmine.ru`.

## Секреты

В репо нет секретов: всё чувствительное — в Cloudflare Secrets (`wrangler secret`) или KV. Twitch Client ID — публичное значение, оно и так попадает в бандл. Демо-озвучки (`public/tts-demo/`) сгенерированы скриптом `scripts/generate-tts-demos.mjs`, ключ которому подаётся только через `CARTESIA_KEY` в окружении.

## Лицензия

[MIT](LICENSE)
