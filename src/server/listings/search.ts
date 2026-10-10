import type { Listing, Prisma, VehicleType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma";

// Genel arama çekirdeği — sorgu kurma + DB. HTTP yok: parametreler doğrudan
// Next.js `searchParams`'ten gelir (string | string[] | undefined olabilir);
// alan bazlı Zod ile çözümlenir, geçersiz tek bir alan aramayı bozmaz.
//
// Politika (brief kararı):
// - Her sorgu yalnız `status: "ACTIVE"` ilanlar (genel okuma yüzeyi).
// - Tarih filtresi yalnız `baslangic` + `bitis` BİRLİKTE ve geçerli
//   (baslangic < bitis) ise uygulanır; tek başına gelen tarih yok sayılır.
// - Geçersiz değerler (ör. sayfa=abc) yok sayılır, varsayılana düşer.

export const SEARCH_PAGE_SIZE = 20;

/** Next.js query değeri: tekrarlı parametrede dizi gelebilir. */
export type SearchQueryValue = string | string[] | undefined;

/** Türkçe anahtarlı arama parametreleri (URL query'den gelir). */
export type SearchParams = {
  sehir?: SearchQueryValue;
  baslangic?: SearchQueryValue;
  bitis?: SearchQueryValue;
  kisi?: SearchQueryValue;
  minFiyat?: SearchQueryValue;
  maxFiyat?: SearchQueryValue;
  aracTipi?: SearchQueryValue;
  sayfa?: SearchQueryValue;
};

/** Alan bazlı doğrulama sonrası aramanın net hâli. */
export type ParsedSearchParams = {
  sehir?: string;
  baslangic?: string;
  bitis?: string;
  kisi?: number;
  minFiyat?: number;
  maxFiyat?: number;
  aracTipi?: VehicleType;
  page: number;
};

const sehirField = z.string().trim().min(1);
const dateField = z.iso.date();
const kisiField = z.coerce.number().int().min(1);
const priceField = z.coerce.number().min(0);
const pageField = z.coerce.number().int().min(1);
const vehicleTypeField = z.enum([
  "TOWED_CARAVAN",
  "PANELVAN",
  "MOTORHOME",
] as const);

/** Tek alanı çözer: yok/boş → undefined, geçersiz → undefined (yok sayılır). */
function parseField<T>(
  schema: z.ZodType<T>,
  value: SearchQueryValue,
): T | undefined {
  const raw = Array.isArray(value) ? value[0] : value; // tekrar: ilk değer
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return undefined;
  }
  const parsed = schema.safeParse(trimmed);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Ham query'yi alan alan doğrular. Tarihler yalnız İKİSİ birlikte geçerliyse
 * korunur (tek tarihli sorgu tarih filtresiz sayılır).
 */
export function parseSearchParams(params: SearchParams): ParsedSearchParams {
  const baslangic = parseField(dateField, params.baslangic);
  const bitis = parseField(dateField, params.bitis);
  // ISO tarihlerinde lexicographic sıra kronolojiktir.
  const datesUsable =
    baslangic !== undefined && bitis !== undefined && baslangic < bitis;

  return {
    sehir: parseField(sehirField, params.sehir),
    baslangic: datesUsable ? baslangic : undefined,
    bitis: datesUsable ? bitis : undefined,
    kisi: parseField(kisiField, params.kisi),
    minFiyat: parseField(priceField, params.minFiyat),
    maxFiyat: parseField(priceField, params.maxFiyat),
    aracTipi: parseField(vehicleTypeField, params.aracTipi),
    page: parseField(pageField, params.sayfa) ?? 1,
  };
}

/** YYYY-MM-DD → UTC gece yarısı Date (@db.Date kolonuyla birebir). */
function isoToUtcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Genel arama: yalnız ACTIVE ilanlar, filtreler + sayfalama.
 * `total` eşleşen toplam kayıt (sayfa sayısı hesabı için).
 */
export async function searchListings(
  params: SearchParams,
): Promise<{ items: Listing[]; total: number }> {
  const parsed = parseSearchParams(params);

  const where: Prisma.ListingWhereInput = { status: "ACTIVE" };
  if (parsed.sehir) {
    where.city = { contains: parsed.sehir, mode: "insensitive" };
  }
  if (parsed.kisi !== undefined) {
    where.capacity = { gte: parsed.kisi };
  }
  if (parsed.aracTipi) {
    where.vehicleType = parsed.aracTipi;
  }
  if (parsed.minFiyat !== undefined || parsed.maxFiyat !== undefined) {
    where.nightlyPrice = { gte: parsed.minFiyat, lte: parsed.maxFiyat };
  }
  if (parsed.baslangic && parsed.bitis) {
    const baslangic = isoToUtcDate(parsed.baslangic);
    const bitis = isoToUtcDate(parsed.bitis);
    // KRİTİK PREDICATE (T9 `findApprovedOverlap` ile birebir aynı):
    // Konaklama aralığı yarım açık [baslangic, bitis); bitişik tarihler
    // (checkout == checkin) ÇAKIŞMAZ. Rezervasyon çakışıyorsa ele:
    //   startDate < bitis AND endDate > baslangic
    // Yalnız kesinleşmiş (APPROVED/COMPLETED) talepler bloklar; PENDING
    // aramada sonucu etkilemez.
    where.bookingRequests = {
      none: {
        status: { in: ["APPROVED", "COMPLETED"] },
        startDate: { lt: bitis },
        endDate: { gt: baslangic },
      },
    };
  }

  const skip = (parsed.page - 1) * SEARCH_PAGE_SIZE;
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: SEARCH_PAGE_SIZE,
    }),
    prisma.listing.count({ where }),
  ]);
  return { items, total };
}
