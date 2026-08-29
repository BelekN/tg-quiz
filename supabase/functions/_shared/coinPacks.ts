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

// Курс: 1 Star ≈ 2 монеты (при условном курсе 1 Star ≈ 2 сом/рубля,
// то есть 1 монета ≈ 1 сом/рубль — числа сумм в магазине не должны
// выглядеть как реальные деньги, см. денонимацию всей экономики монет
// в 055_coin_denomination.sql).
export const COIN_PACKS: CoinPack[] = [
  { key: "coins_small", title: "100 монет", stars: 50, coins: 100 },
  { key: "coins_medium", title: "300 монет", stars: 150, coins: 300 },
  { key: "coins_large", title: "800 монет", stars: 400, coins: 800 },
];

export function findCoinPack(key: string): CoinPack | null {
  return COIN_PACKS.find((p) => p.key === key) ?? null;
}
