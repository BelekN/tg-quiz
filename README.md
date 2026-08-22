# КвизДуэль — Дуэль с друзьями (Фаза 1)

Telegram Mini App: React 19 + Vite + Tailwind v4 + Supabase.

## Архитектура

```
Mini App (React)
   │  POST /functions/v1/tg-api
   │  Authorization: tma <initDataRaw>
   ▼
Edge Function tg-api (Deno)
   │  1. проверяет HMAC-подпись initData ботовым токеном
   │  2. вызывает RPC под service_role
   ▼
Postgres: upsert_user / start_duel / answer_question / finish_duel
```

Клиент **не обращается к таблицам напрямую**: на всех таблицах включён
RLS, а политик нет — для `anon` доступ закрыт полностью. Единственный
путь к данным — Edge Function на `service_role`.

Что из этого следует:

- очки и монеты считает Postgres, клиент их только отображает;
- `correct_option_index` никогда не уезжает в бандл: правильный ответ
  приходит по одному, **после** того как выбор игрока записан
  (`answer_question`), и только на текущий вопрос — порядок жёстко
  проверяется, перескочить на 5-й вопрос нельзя;
- время ответа приходит с клиента и потому клампится в `[0, 10000]` мс:
  максимум, что даёт накрутка — бонус за скорость, не более 100 очков
  за вопрос.

## Структура

```
src/
  App.jsx                  автомат экранов: boot → home → quiz → result
  lib/telegram.js          SDK, initData, шэринг, хаптика
  lib/api.js               единственный клиент к Edge Function
  lib/mock.js              заглушки для вёрстки без бэкенда
  hooks/useCountdown.js    таймер на performance.now (не «плывёт»)
  screens/HomeScreen.jsx   привет, баланс, «Создать дуэль», Скоро
  screens/QuizScreen.jsx   5 вопросов, 10 сек, шкала, зелёный/красный
  screens/ResultScreen.jsx итог, монеты, «Вызвать друга»
  components/              Screen, Avatar, CoinBadge, TimerBar,
                           AnswerButton, ModeCard, StateView
supabase/
  migrations/001_init.sql  таблицы, RLS, RPC, сид вопросов
  functions/tg-api/        Edge Function + проверка подписи initData
```

## Установка

**1. База.** Открыть Supabase SQL Editor → вставить целиком
`supabase/migrations/001_init.sql` → Run. Скрипт идемпотентен.

**2. Edge Function.**

```bash
supabase link --project-ref <project-ref>
supabase secrets set BOT_TOKEN=123456:AA...
supabase functions deploy tg-api --no-verify-jwt
```

`--no-verify-jwt` обязателен: авторизация здесь своя, по `initData`,
а не по Supabase JWT.

**3. `.env`** (см. `.env.example`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BOT_USERNAME=your_bot
VITE_APP_SHORT_NAME=quiz
```

**4. BotFather.** `/newapp` → привязать short name и URL деплоя.

## Разработка

```bash
npm run dev                    # внутри Telegram (нужен https-туннель)
VITE_DEV_MOCK=1 npm run dev    # вёрстка в обычном браузере, без бэкенда
npm run build
```

В мок-режиме `lib/api.js` отдаёт данные из `lib/mock.js` — все экраны
кликаются локально.

## Ссылка-приглашение

```
https://t.me/<bot>/<app>?startapp=duel_<uuid>
```

Именно `?startapp=`, **не** `?start=`. `?start=` открывает чат с ботом
и посылает ему `/start duel_<id>` — мини-апп при этом не запускается.
`?startapp=` открывает мини-апп, а значение приходит в
`initData.startParam`.

## Начисления

| Событие                | Очки            | Монеты |
| ---------------------- | --------------- | ------ |
| Правильный ответ       | 100 + до 100 за скорость | +5 |
| Победа в дуэли         | —               | +20    |
| Ничья                  | —               | +10    |

## Что не входит в Фазу 1

- Realtime: соперник не виден «вживую», итог считается когда оба
  доиграли; экран результата у хоста показывает «Ждём соперника».
- Просмотр завершённых дуэлей и истории — нужен отдельный read-RPC.
- Режимы «Спринт» и «Квиз-тесты» — плашки со статусом «Скоро».
