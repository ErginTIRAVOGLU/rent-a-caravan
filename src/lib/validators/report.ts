import { z } from "zod";

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
