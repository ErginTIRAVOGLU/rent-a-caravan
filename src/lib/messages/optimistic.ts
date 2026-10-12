// Optimistic mesaj mutabakatı: gönderilen ama henüz sunucu listesine
// düşmüş görünmeyen mesajlar, poll ile gelen sunucu verisinde göründüğü
// anda listeden çıkarılır. Saf fonksiyon — ConversationThread render'ında
// türetilir (effect'te setState kademeli render tetiklerdi).

type MessageLike = {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date | string;
};

/**
 * `optimistic` listesinden, `serverMessages` içinde karşılığı olanları çıkarır.
 *
 * Eşleşme kriterleri (bire bir, sırayla):
 * - `id` bire bir aynıysa, veya
 * - aynı `senderId` + aynı `content` ve sunucu mesajı, optimistic'in
 *   `createdAt` anından 1 saniye sonra üretilmişse (yankı penceresi).
 *
 * Sonuç değişmiyorsa **aynı referans** döner — gereksiz render tetiklemez.
 * Eski geçmişteki aynı içerikli mesajlar zaman penceresiyle elenir.
 */
export function reconcileOptimistic<T extends MessageLike>(
  optimistic: T[],
  serverMessages: readonly MessageLike[],
): T[] {
  if (optimistic.length === 0 || serverMessages.length === 0) {
    return optimistic;
  }
  const remaining = [...optimistic];
  for (const server of serverMessages) {
    const serverTime = new Date(server.createdAt).getTime();
    const index = remaining.findIndex(
      (opt) =>
        opt.id === server.id ||
        (opt.senderId === server.senderId &&
          opt.content === server.content &&
          serverTime >= new Date(opt.createdAt).getTime() - 1000),
    );
    if (index >= 0) remaining.splice(index, 1);
  }
  return remaining.length === optimistic.length ? optimistic : remaining;
}
