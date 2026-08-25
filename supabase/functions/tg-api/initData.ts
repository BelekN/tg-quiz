// Проверка подписи initData по алгоритму Telegram.
// Живёт ТОЛЬКО на сервере: требует BOT_TOKEN, который нельзя
// отдавать в бандл фронтенда.

const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)),
  );
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramUser;
  startParam: string | null;
  authDate: number;
}

/**
 * @param raw       строка initData ровно в том виде, в котором её отдал Telegram
 * @param botToken  токен бота (env BOT_TOKEN)
 * @param maxAgeSec максимальный «возраст» подписи, защита от replay
 */
export async function verifyInitData(
  raw: string,
  botToken: string,
  // Было 24 часа — намного шире, чем реальная сессия игры (дуэль/спринт
  // занимают минуты). Telegram переотдаёт initData при каждом открытии
  // Mini App, так что 1 час — комфортный запас на одну сессию игры, но
  // не даёт утёкшей строке initData работать почти сутки.
  maxAgeSec = 60 * 60,
): Promise<VerifiedInitData> {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) throw new Error("INIT_DATA_NO_HASH");

  // data_check_string: все пары КРОМЕ hash, отсортированы по ключу.
  // signature (Ed25519, отдельная независимая подпись) остаётся —
  // это обычное поле данных для классической HMAC-проверки, здесь
  // не участвует только сам hash, который мы и сверяем.
  const checkString = [...params.entries()]
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const signature = toHex(await hmac(secret, checkString));

  // сравнение постоянного времени
  let diff = signature.length === hash.length ? 0 : 1;
  for (let i = 0; i < Math.max(signature.length, hash.length); i++) {
    diff |= (signature.charCodeAt(i) || 0) ^ (hash.charCodeAt(i) || 0);
  }
  if (diff !== 0) throw new Error("INIT_DATA_BAD_HASH");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
    throw new Error("INIT_DATA_EXPIRED");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("INIT_DATA_NO_USER");
  let user: TelegramUser;
  try {
    user = JSON.parse(rawUser) as TelegramUser;
  } catch {
    throw new Error("INIT_DATA_NO_USER");
  }
  if (typeof user.id !== "number") throw new Error("INIT_DATA_NO_USER");

  return { user, startParam: params.get("start_param"), authDate };
}
