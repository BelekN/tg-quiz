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
  migrations/001_init.sql  таблицы, RLS, RPC, сид вопросов (10 шт.)
  migrations/002+          схема и RPC-логика (не вопросы — см. ниже)
  questions/bank.sql        ЕДИНСТВЕННЫЙ актуальный срез базы вопросов
                            (1000 вопросов, 10 категорий по 100, у каждого
                            задан уровень сложности). Идемпотентен.
  questions/personas.sql   контент раздела "Узнай себя" (см. 022_*.sql)
  functions/tg-api/        Edge Function + проверка подписи initData
```

## Установка

**1. База.** Открыть Supabase SQL Editor → по очереди:
`supabase/migrations/001_init.sql` → Run, затем все `002_*.sql` …
`040_*.sql` по номерам (это схема, RPC и расписание pg_cron, не
вопросы; в `011_cron_schedule.sql` перед запуском подставь свой
`CRON_SECRET` вместо `<CRON_SECRET>`), затем `supabase/questions/bank.sql`
(вопросы дуэли/соло/спринта) и `supabase/questions/personas.sql`
(контент раздела "Узнай себя"). Все скрипты идемпотентны, можно
прогонять повторно.

**2. Edge Function.**

```bash
supabase link --project-ref <project-ref>
supabase secrets set BOT_TOKEN=123456:AA...
supabase functions deploy tg-api --no-verify-jwt
```

`--no-verify-jwt` обязателен: авторизация здесь своя, по `initData`,
а не по Supabase JWT.

Необязательные секреты `tg-api`:

- `SUPPORT_TG_ID` — личный chat_id, куда форвардить "Сообщить о
  проблеме" и крэши рендера (см. `ErrorBoundary.jsx`). Без него отчёты
  всё равно сохраняются в `bug_reports`, просто без мгновенного пуша.
- `MIN_APP_VERSION` — принудительное обновление фронта. Если задан и
  версия клиента (`package.json` → `__APP_VERSION__`, см.
  `vite.config.js`) ниже этого значения, `me` отвечает
  `force_update: true`, и клиент показывает блокирующий экран вместо
  приложения (`ForceUpdateScreen.jsx`) до перезагрузки. По умолчанию
  не задан — механизм существует, но не действует, пока не понадобится
  реальный breaking-релиз: `supabase secrets set MIN_APP_VERSION=1.1.0`.

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
npm test                       # vitest: чистая логика (lib/*) + компоненты
```

В мок-режиме `lib/api.js` отдаёт данные из `lib/mock.js` — все экраны
кликаются локально.

Тесты (`*.test.js`/`*.test.jsx`, рядом с тестируемым файлом) сейчас
покрывают клиентскую логику — ранги, форматирование чисел, скоринг
"Узнай себя", `BackButton`. RPC/SQL по-прежнему проверяются вручную
через `supabase db query --linked` (см. любую миграцию) — pgTAP пока
не подключён.

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

## Настройки, крэши, лимиты

- **Настройки** (`SettingsScreen.jsx`, ⚙️ на главном экране): хаптика
  (только `localStorage`, per-device), напоминания (сервер,
  `users.reminders_enabled` — влияет на `get_duel_reminders` /
  `get_inactivity_reminders` в `tg-cron`, но не на транзакционные пуши
  вроде итога дуэли), версия приложения, ссылки на политику
  конфиденциальности и условия использования.
- **Крэши рендера** (`ErrorBoundary.jsx`) уходят в тот же канал, что и
  ручное "Сообщить о проблеме" (`report_issue` → пуш в
  `SUPPORT_TG_ID`), с `context.kind: "crash"` — в Telegram помечены
  `💥` вместо `🐞`, чтобы сразу отличать от отчётов пользователей.
- **Лимит на баг-репорты**: не больше 5 отчётов в час на пользователя
  (проверяется прямо в RPC `report_issue`, код ошибки `RATE_LIMITED`) —
  раньше аудиторией были только друзья, теперь приложение открыто для
  всех.

## Каталог Telegram Mini Apps

`public/privacy.html` и `public/terms.html` — статичные копии текста из
`src/locales/ru.js` (privacy/terms), доступные по прямой ссылке без
входа в приложение: `https://<домен>/privacy.html` и `/terms.html`.
Они существуют для одной цели — зарегистрировать их в @BotFather
(`/mybots` → бот → _Bot Settings_ → _Configure Mini App_ →
_Privacy Policy_), чтобы в системном меню мини-аппы Telegram показывал
нашу политику, а не свою стандартную. Экран внутри приложения
(`PrivacyPolicyScreen.jsx`) их не заменяет — это разные поверхности,
нужны обе. Меняешь текст политики — обновляй в обоих местах.

Отдельно там же, в _Configure Mini App_, стоит включить **Main Mini
App** (даёт кнопку "Launch app" на профиле бота и попадание в таб
_Apps_ у тех, кто уже открывал приложение) — без этого органический
рост сильно ограничен обычными инвайт-ссылками на дуэль.

## Локализация

Интерфейс сейчас только на русском, но новые экраны (Настройки,
Политика, Условия, принудительное обновление) уже написаны через
`t('ключ')` из `src/lib/i18n.js`, со словарём в `src/locales/ru.js`.
Остальной, более старый текст приложения пока зашит прямо в JSX —
переписывать его не требовалось, только подготовить путь для будущего
языка. Чтобы добавить язык:

1. Создать `src/locales/<code>.js` с тем же набором ключей, что в `ru.js`.
2. Импортировать и добавить в `DICTS`/`LOCALES` в `src/lib/i18n.js`.
3. Постепенно переводить остальные экраны на `t()` по мере необходимости.

## Что не входит

- Realtime: соперник не виден «вживую», итог считается когда оба
  доиграли; экран результата у хоста показывает «Ждём соперника».
