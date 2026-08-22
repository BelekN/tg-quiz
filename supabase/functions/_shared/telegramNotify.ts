// Обычное сообщение бота = наш "пуш": Telegram сам показывает его
// как системную нотификацию, никакого Push API не нужно.
export async function sendTelegramMessage(
  botToken: string,
  tgId: number | bigint,
  text: string,
  button?: { text: string; url: string },
) {
  const body: Record<string, unknown> = {
    chat_id: tgId,
    text,
    parse_mode: "HTML",
  };
  if (button) {
    body.reply_markup = { inline_keyboard: [[{ text: button.text, url: button.url }]] };
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

export function appDeepLink(botUsername: string, appShortName: string, startParam?: string) {
  const base = appShortName
    ? `https://t.me/${botUsername}/${appShortName}`
    : `https://t.me/${botUsername}`;
  return startParam ? `${base}?startapp=${startParam}` : base;
}
