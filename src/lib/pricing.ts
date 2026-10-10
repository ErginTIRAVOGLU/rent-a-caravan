import type { Prisma } from "@prisma/client";

// Saf fiyat fonksiyonları — DB/İstemci yok; Decimal ile para hesabı (asla float).

// Gece = gün farkı: YYYY-MM-DD tarihler UTC gece yarısı bazlı karşılaştırılır.
const MS_PER_DAY = 86_400_000;

/** İki YYYY-MM-DD tarihi arasındaki gece sayısı (UTC gece yarısı bazlı). */
export function calculateNights(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / MS_PER_DAY);
}

/** Toplam fiyat: nights × nightlyPrice — yalnızca Decimal ile, sunucuda. */
export function calculateTotalPrice(
  nights: number,
  nightlyPrice: Prisma.Decimal,
): Prisma.Decimal {
  return nightlyPrice.mul(nights);
}
