# Адаптация фронтенда под Telegram Mini App

## 1. Подключи Telegram Web App SDK

В `index.html` твоего собранного фронтенда, перед основным скриптом:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

В коде приложения (например, в начале `App`):

```js
useEffect(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand(); // открыть на всю высоту
  }
}, []);
```

## 2. Замени `window.storage` на реальный API

`window.storage` работает только внутри артефактов Claude — вне Claude.ai его нет.
После переноса в Telegram все обращения к задачам идут через backend из `server.js`:

```js
const API_URL = "https://your-backend.example.com";

async function apiRequest(path, options = {}) {
  const initData = window.Telegram?.WebApp?.initData || "";
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// Примеры:
const tasks = await apiRequest("/api/tasks");
await apiRequest("/api/tasks", { method: "POST", body: JSON.stringify(newTask) });
await apiRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: true }) });
await apiRequest(`/api/tasks/${id}`, { method: "DELETE" });
```

`X-Telegram-Init-Data` — это подпись Telegram, которую backend проверяет
(`verifyInitData` в `server.js`), чтобы быть уверенным, что запрос
действительно пришёл из Mini App этого пользователя, а не подделан.

## 3. Подстройся под тему Telegram (необязательно, но красиво)

```js
const tg = window.Telegram?.WebApp;
const themeParams = tg?.themeParams || {};
// themeParams.bg_color, themeParams.text_color и т.д. — можно
// прокинуть в CSS-переменные вместо жёстко заданных COLORS.
```
