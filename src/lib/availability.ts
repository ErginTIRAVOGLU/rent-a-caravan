import type { Prisma, PrismaClient } from "@prisma/client";

// Rezervasyon çakışma denetimi — T8 arama filtresiyle BİREBİR aynı predicate
// (src/server/listings/search.ts "KRİTİK PREDICATE" bloğu):
//   status IN (APPROVED, COMPLETED) AND startDate < bitis AND endDate > baslangic
// Yarım-open aralık [giriş, çıkış) nedeniyle bitişik tarihler (çıkış = giriş)
// ÇAKIŞMAZ. Yalnız kesinleşmiş talepler bloklar; PENDING/REJECTED/CANCELLED
// takvimi serbest bırakır.

/** DB istemcisi veya transaction client'ı — core'lar tx üzerinden çağırır. */
export type BookingDb = PrismaClient | Prisma.TransactionClient;

/** YYYY-MM-DD string veya DB'den gelen UTC gece yarısı Date → Date. */
function toUtcDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * İlanın onaylanmış/ tamamlanmış takviminde aralığıyla çakışan tek kaydı döner
 * (yoksa null).
 *
 * `excludeId` — kendi kaydını yok say (ör. aynı onayın transaction içinde
 * yeniden girişi); PENDING→APPROVED yolunda kuşak olarak da tutulur.
 */
export async function findApprovedOverlap(
  db: BookingDb,
  listingId: string,
  startDate: Date | string,
  endDate: Date | string,
  excludeId?: string,
): Promise<{ id: string } | null> {
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);
  return db.bookingRequest.findFirst({
    where: {
      listingId,
      status: { in: ["APPROVED", "COMPLETED"] },
      startDate: { lt: end },
      endDate: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}
