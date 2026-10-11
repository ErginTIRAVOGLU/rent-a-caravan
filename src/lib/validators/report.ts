import { z } from "zod";
import type { ReportStatus } from "@prisma/client";

// Şikayet giriş şeması — tek doğrulama kaynağı: "Bildir" dialogu (istemci) ve
// createReportCore (sunucu) AYNI kuralları kullanır. Hata mesajları Türkçe,
// enum/DB değerleri İngilizce.
// NOT: `targetId` şemaya alınmaz — biçim hatası hedef tipine göre farklı
// mesaj verir ("Geçersiz ilan kimliği" / "Geçersiz kullanıcı kimliği");
// service bunu tipi çözüldükten SONRA doğrular.

/** Gerekçe sınırları (spec §8) — UI sayacı ve service doğrulaması bunları okur. */
export const REPORT_REASON_MIN = 5;
export const REPORT_REASON_MAX = 500;

export const reportInputSchema = z.object({
  /** Hedef tipi — DB `ReportTargetType` kodlarıyla birebir. */
  targetType: z.enum(["LISTING", "USER"], "Geçersiz hedef tipi."),
  /** Bildirim gerekçesi: 5–500 karakter (boşluklar kırpılır). */
  reason: z
    .string("Bildirim gerekçesi zorunludur.")
    .trim()
    .min(
      REPORT_REASON_MIN,
      `Gerekçe en az ${REPORT_REASON_MIN} karakter olmalıdır.`,
    )
    .max(
      REPORT_REASON_MAX,
      `Gerekçe en fazla ${REPORT_REASON_MAX} karakter olabilir.`,
    ),
});

/** Şikayet durumu — DB `ReportStatus` kodları (istemciden gelen değer için). */
export const reportStatusSchema = z.enum(
  ["OPEN", "REVIEWING", "CLOSED"],
  "Geçersiz şikayet durumu.",
);

/**
 * Sunucu eylemi girdisi — `status` alanını saran nesne: Zod hata yolundan
 * doğrudan `field: "status"` çıkar (bare enum'da issue path boş kalır ve
 * `ActionResult.field` undefined olurdu).
 */
export const reportStatusInputSchema = z.object({
  status: reportStatusSchema,
});

/**
 * Durum geçiş matrisi — TEK KAYNAK. `src/server/reports/service.ts` (sunucu
 * otoritesi) ve `NEXT_REPORT_STATUS` (admin kuyruğu satır düğmeleri) aynı
 * nesneyi okur; kural değişirse (ör. OPEN→CLOSED kısayolu) iki yer birlikte
 * güncellenir, sessizce diverge etmez.
 *
 * OPEN → REVIEWING → CLOSED; CLOSED terminal (geri açılmaz), listede olmayan
 * her geçiş reddedilir.
 */
export const REPORT_STATUS_TRANSITIONS: Record<
  ReportStatus,
  readonly ReportStatus[]
> = {
  OPEN: ["REVIEWING"],
  REVIEWING: ["CLOSED"],
  CLOSED: [],
};

/**
 * Satır düğmesi için matristeki TEK sonraki durum — `REPORT_STATUS_TRANSITIONS`
 * üzerinden türetilir. CLOSED terminal → null (kuyruk satırında düğme yok).
 * Yetki/geçiş doğrulaması yine sunucuda yapılır; bu harita yalnız hangi
 * düğmenin GÖSTERİLECEĞİNİ belirler.
 */
export const NEXT_REPORT_STATUS: Record<ReportStatus, ReportStatus | null> = {
  OPEN: REPORT_STATUS_TRANSITIONS.OPEN[0] ?? null,
  REVIEWING: REPORT_STATUS_TRANSITIONS.REVIEWING[0] ?? null,
  CLOSED: REPORT_STATUS_TRANSITIONS.CLOSED[0] ?? null,
};
