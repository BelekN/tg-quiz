// Единственный источник цен на пачки монет за Stars — используется и
// в tg-api (создание инвойса), и в tg-webhook (проверка перед оплатой
// + начисление после). Цену ВСЕГДА берём отсюда по ключу пачки, а не
// из того, что прислал клиент — иначе можно было бы заказать инвойс
// на 1 звезду и получить payload от дорогой пачки.
export interface CoinPack {
  key: string;
  title: string;
  stars: number;
  coins: number;
}

export const COIN_PACKS: CoinPack[] = [
  { key: "coins_small", title: "500 монет", stars: 50, coins: 500 },
  { key: "coins_medium", title: "1 800 монет", stars: 150, coins: 1800 },
  { key: "coins_large", title: "5 500 монет", stars: 400, coins: 5500 },
];

export function findCoinPack(key: string): CoinPack | null {
  return COIN_PACKS.find((p) => p.key === key) ?? null;
}
