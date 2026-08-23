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
}

// parse_mode: "HTML" интерпретирует <, > и & как разметку. Имена
// пользователей (first_name, username) приходят от самого Telegram,
// но их значение задаёт человек — без экранирования кривое имя
// валит sendMessage ("can't parse entities"), а умышленно подобранное
// может воткнуть в чужой чат произвольную ссылку/форматирование.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function appDeepLink(botUsername: string, appShortName: string, startParam?: string) {
  const base = appShortName
    ? `https://t.me/${botUsername}/${appShortName}`
    : `https://t.me/${botUsername}`;
  return startParam ? `${base}?startapp=${startParam}` : base;
}
