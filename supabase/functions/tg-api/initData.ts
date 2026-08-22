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
  maxAgeSec = 24 * 60 * 60,
): Promise<VerifiedInitData> {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) throw new Error("INIT_DATA_NO_HASH");

  // data_check_string: все пары кроме hash/signature, отсортированы по ключу
  const checkString = [...params.entries()]
    .filter(([k]) => k !== "hash" && k !== "signature")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const signature = toHex(await hmac(secret, checkString));

  // сравнение постоянного времени
  if (signature.length !== hash.length) throw new Error("INIT_DATA_BAD_HASH");
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  if (diff !== 0) throw new Error("INIT_DATA_BAD_HASH");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
    throw new Error("INIT_DATA_EXPIRED");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new Error("INIT_DATA_NO_USER");
  const user = JSON.parse(rawUser) as TelegramUser;
  if (typeof user.id !== "number") throw new Error("INIT_DATA_NO_USER");

  return { user, startParam: params.get("start_param"), authDate };
}
