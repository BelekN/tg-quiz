// Обычное сообщение бота = наш "пуш": Telegram сам показывает его
// как системную нотификацию, никакого Push API не нужно.
//
// button.webApp=true -> кнопка типа web_app (запускает Mini App
// напрямую и даёт Telegram показать быстрый "OPEN" прямо в списке
// чатов у последнего сообщения — как у Wallet и других мини-аппов).
// ВАЖНО: у web_app-кнопки нет startParam — Telegram не прокидывает
// его в initData так, как для t.me/bot/short_name?startapp=...
// Поэтому там, где нужен startParam (приглашение на дуэль), кнопка
// остаётся обычной url-ссылкой на t.me, без web_app.
export async function sendTelegramMessage(
  botToken: string,
  tgId: number | bigint,
  text: string,
  button?: { text: string; url: string; webApp?: boolean },
) {
  const body: Record<string, unknown> = {
    chat_id: tgId,
    text,
    parse_mode: "HTML",
  };
  if (button) {
    const btn = button.webApp
      ? { text: button.text, web_app: { url: button.url } }
      : { text: button.text, url: button.url };
    body.reply_markup = { inline_keyboard: [[btn]] };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Самая частая причина — пользователь не открывал бота вообще
      // (ещё не запускал /start) или заблокировал его. Не фатально:
      // просто пропускаем, следующий пуш не должен упасть из-за этого.
      console.error("sendTelegramMessage failed", tgId, await res.text().catch(() => ""));
    }
  } catch {
    // fetch() сам может бросить (обрыв сети/DNS) с Error, чей .message
    // часто включает полный URL запроса — а в нём BOT_TOKEN. Ловим здесь
    // же и логируем без деталей ошибки, чтобы токен не утёк в логи.
    console.error("sendTelegramMessage network error", tgId);
  }
}

// parse_mode: "HTML" интерпретирует <, > и & как разметку. Имена
// пользователей (first_name, username) приходят от самого Telegram,
// но их значение задаёт человек — без экранирования кривое имя
// валит sendMessage ("can't parse entities"), а умышленно подобранное
// может воткнуть в чужой чат произвольную ссылку/форматирование.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Обычное "a !== b" завершается на первом несовпавшем байте — по
// разнице во времени в принципе можно угадывать секрет байт за байтом.
// Секреты (WEBHOOK_SECRET/CRON_SECRET) короткоживущие и не публичные,
// риск невысок, но раз initData.ts уже сравнивает так — держим
// единый стандарт везде, где сверяем секрет с заголовком запроса.
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export function appDeepLink(botUsername: string, appShortName: string, startParam?: string) {
  const base = appShortName
    ? `https://t.me/${botUsername}/${appShortName}`
    : `https://t.me/${botUsername}`;
  return startParam ? `${base}?startapp=${startParam}` : base;
}
