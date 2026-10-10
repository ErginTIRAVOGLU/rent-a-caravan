import type { Prisma } from "@prisma/client";

import { calculateNights, calculateTotalPrice } from "./pricing";
import { fail, ok, type ActionResult } from "./result";
import { firstIssue } from "./validators/auth";
import { staySchema, type StayInput } from "./validators/booking";

// Konaklama kural doğrulaması — saf mantık (DB/İstemci yok).
// spec §5: tarih kuralları SIRAYLA uygulanır; ilk ihlalde fail(msg, field).

export type StayRules = {
  minRentalDays: number;
  capacity: number;
};

export type StayQuote = {
  nights: number;
  totalPrice: Prisma.Decimal;
};

/** En fazla konaklama süresi (gece). */
const MAX_NIGHTS = 30;

/** Varsayılan "bugün": gerçek tarihin UTC YYYY-MM-DD biçimi (testler parametreyle geçer). */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function validateStay(
  rules: StayRules,
  input: StayInput,
  nightlyPrice: Prisma.Decimal,
  today: string = utcToday(),
): ActionResult<StayQuote> {
  // Biçim doğrulaması: bozuk tarih (ör. 2026-13-40) burada field ile döner.
  const parsed = staySchema.safeParse(input);
  if (!parsed.success) {
    const issue = firstIssue(parsed.error);
    return fail(issue.message, issue.field);
  }
  const { startDate, endDate, guests } = parsed.data;

  // Kural 1: startDate >= bugün. (ISO YYYY-MM-DD alfabetik sıralama = kronolojik.)
  if (startDate < today) {
    return fail("Başlangıç tarihi bugünden önce olamaz.", "startDate");
  }

  // Kural 2: endDate > startDate (aynı gün veya geriye gidiş hata).
  if (endDate <= startDate) {
    return fail("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.", "endDate");
  }

  const nights = calculateNights(startDate, endDate);

  // Kural 3: en fazla 30 gece.
  if (nights > MAX_NIGHTS) {
    return fail("Konaklama süresi en fazla 30 gece olabilir.", "endDate");
  }

  // Kural 4: en az listing.minRentalDays gece.
  if (nights < rules.minRentalDays) {
    return fail(`En az ${rules.minRentalDays} gece konaklanabilir.`, "endDate");
  }

  // Kural 5: guests <= listing.capacity.
  if (guests > rules.capacity) {
    return fail(`En fazla ${rules.capacity} kişi kabul edilir.`, "guests");
  }

  // Fiyat yalnızca sunucuda: nights × nightlyPrice (Decimal).
  return ok({ nights, totalPrice: calculateTotalPrice(nights, nightlyPrice) });
}
