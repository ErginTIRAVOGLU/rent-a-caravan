import { prisma } from "./prisma";
import { fail, ok, type ActionResult } from "./result";

// Spec §5: DB sayaçlı hız sınırı — ek servis yok; RateLimitEntry sayacı
// (key, bucket) ile benzersizdir, `expiresAt` pencere ucunu taşır.
// Sabit pencere: pencere içinde sayaç artar, `expiresAt` dolunca sonraki
// istek sayacı 1'e sıfırlar ve yeni pencereyi yazar.

/** Rezervasyon talebi (T11): kullanıcı başına 5 istek / 60 sn. */
export const BOOKING_LIMIT = { limit: 5, windowSeconds: 60 } as const;
/** Mesaj gönderimi (Plan 2): kullanıcı başına 20 istek / 60 sn. */
export const MESSAGE_LIMIT = { limit: 20, windowSeconds: 60 } as const;
/** Doğrulama e-postası tekrar gönderimi: adres başına 5 istek / 60 sn. */
export const VERIFY_RESEND_LIMIT = { limit: 5, windowSeconds: 60 } as const;

const RATE_LIMIT_ERROR = "Çok fazla istek gönderdiniz, biraz bekleyin";

/**
 * Hız sınırını atomik olarak uygular ve sayacı bir "istek" olarak işler.
 *
 * Yarış dayanıklılığı: `INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`
 * TEK statement'te üç durumu da kapatır —
 *   1) ilk istek → count = 1,
 *   2) aktif pencere → count + 1 (atomik increment),
 *   3) süresi dolmuş pencere (`expiresAt <= now`) → count = 1 + yeni expiresAt.
 * Read-then-write yok: çift tıklama baskınlarında (eşzamanlı istekler) sayaç
 * asla eksik saymaz; RETURNING edilen count limit kararını verir.
 *
 * `bucket`: sayacın türü ("booking"/"message"/"verify") — aynı kullanıcı için türler
 * birbirinden bağımsız sayılır. `key`: kullanıcı kimliği.
 */
export async function assertRateLimit(
  kind: "booking" | "message" | "verify",
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<ActionResult<true>> {
  // windowSeconds < 1 pratikte imkânsız (yalnız sabit pin'lerden çağrılır);
  // yine de güvence: 0/negatif → Invalid Date → 500 yerine kontrollü fail.
  if (!Number.isFinite(windowSeconds) || windowSeconds < 1) {
    return fail(RATE_LIMIT_ERROR);
  }
  const now = Date.now();
  const nowDate = new Date(now);
  // Sabit pencere: başlangıcı windowSeconds'e bölünür; expiresAt = pencere ucu.
  const windowEnd = new Date(
    (Math.floor(now / 1000 / windowSeconds) + 1) * windowSeconds * 1000,
  );

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitEntry" ("key", "bucket", "count", "expiresAt")
    VALUES (${key}, ${kind}, 1, ${windowEnd})
    ON CONFLICT ("key", "bucket") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitEntry"."expiresAt" <= ${nowDate} THEN 1
        ELSE "RateLimitEntry"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "RateLimitEntry"."expiresAt" <= ${nowDate} THEN ${windowEnd}
        ELSE "RateLimitEntry"."expiresAt"
      END
    RETURNING "count"
  `;
  const count = rows[0]?.count ?? 1;
  if (count > limit) {
    return fail(RATE_LIMIT_ERROR);
  }
  return ok(true);
}
