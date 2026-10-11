import type { EmailMessage } from "./client";

// Türkçe HTML şablonlar — saf fonksiyonlar (DB/React yok). Veri şekilleri
// prisma tiplerinden (BookingRequest, Listing) türetildi; charset UTF-8
// zorunlu ki Türkçe karakterler (ç, ğ, ı, ş, ö, ü) bozulmasın.

export interface BookingRequestedData {
  renterName: string;
  listingTitle: string;
  startDate: Date;
  endDate: Date;
}

export interface BookingStatusChangedData {
  listingTitle: string;
  startDate: Date;
  endDate: Date;
  status: "APPROVED" | "REJECTED";
  reason?: string;
}

export interface ListingStatusChangedData {
  listingTitle: string;
  status: "ACTIVE" | "REJECTED" | "PAUSED";
  reason?: string;
}

/** Tamamlanan konaklamada (T11 cron'u) kiracıya gönderilen değerlendirme daveti. */
export interface BookingCompletedData {
  listingTitle: string;
  /** İlan sayfası: `${NEXT_PUBLIC_APP_URL}/ilan/${listingId}`. */
  listingUrl: string;
}

// Prisma `DateTime @db.Date` → UTC gece yarısı; tr-TR gösterimi DD.MM.YYYY.
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

// Kullanıcı verisi (ilan başlığı, gerekçe) HTML'e gömülmeden önce kaçırılır.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Basit ortak gövde: başlık + satır satır bilgi.
function layout(heading: string, lines: string[]): string {
  return [
    "<!doctype html>",
    '<html lang="tr">',
    '<head><meta charset="utf-8" /></head>',
    '<body style="font-family: Arial, sans-serif; color: #1f2937;">',
    `<h1 style="font-size: 20px;">${heading}</h1>`,
    ...lines.map((line) => `<p style="font-size: 15px;">${line}</p>`),
    '<p style="font-size: 13px; color: #6b7280;">Bu e-posta Karavan Kiralama platformu tarafından otomatik gönderildi.</p>',
    "</body>",
    "</html>",
  ].join("\n");
}

/** Kiracıya: talebin alındığı bildirimi. */
export function bookingRequestedTemplate(
  to: string,
  data: BookingRequestedData,
): EmailMessage {
  const heading = "Karavan talebiniz alındı";
  return {
    to,
    subject: heading,
    html: layout(heading, [
      `Sayın ${escapeHtml(data.renterName)},`,
      `${escapeHtml(data.listingTitle)} karavanı için ${formatDate(data.startDate)} – ${formatDate(data.endDate)} tarihli kiralama talebiniz ilan sahibine iletildi.`,
      "Sahibi onayladığında size haber vereceğiz.",
    ]),
  };
}

/** Kiracıya: talep onaylandı / reddedildi bildirimi. */
export function bookingStatusChangedTemplate(
  to: string,
  data: BookingStatusChangedData,
): EmailMessage {
  const approved = data.status === "APPROVED";
  const heading = approved ? "Talebiniz onaylandı" : "Talebiniz reddedildi";
  const lines = [
    "Sayın kullanıcımız,",
    `${escapeHtml(data.listingTitle)} karavanı için ${formatDate(data.startDate)} – ${formatDate(data.endDate)} tarihli kiralama talebiniz ${approved ? "sahibi tarafından onaylandı." : "maalesef reddedildi."}`,
  ];
  if (!approved && data.reason) {
    lines.push(`Gerekçe: ${escapeHtml(data.reason)}`);
  }
  return { to, subject: heading, html: layout(heading, lines) };
}

/**
 * Kiracıya: konaklama tamamlandı + değerlendirme daveti (T5 şablonları yalnız
 * ONAY/RET bilir; tamamlanma için ayrı şablon gerekir). İlan başlığı kullanıcı
 * verisidir — escapeHtml ile kaçırılır; bağlantı ilan sayfasına gider.
 */
export function bookingCompletedTemplate(
  to: string,
  data: BookingCompletedData,
): EmailMessage {
  const heading = "Konaklama tamamlandı — deneyiminizi değerlendirin";
  return {
    to,
    subject: heading,
    html: layout(heading, [
      "Sayın kullanıcımız,",
      `${escapeHtml(data.listingTitle)} karavanındaki konaklamanız tamamlandı. Umarız güzel zaman geçirmişsinizdir.`,
      "Deneyiminizi paylaşarak diğer kullanıcıların doğru seçim yapmasına yardımcı olabilirsiniz:",
      `<p style="font-size: 15px;"><a href="${escapeHtml(data.listingUrl)}" style="color: #2563eb;">İlanı görüntüle ve değerlendir</a></p>`,
    ]),
  };
}

const LISTING_STATUS_TEXT: Record<
  ListingStatusChangedData["status"],
  { heading: string; body: string }
> = {
  ACTIVE: {
    heading: "İlanınız yayında",
    body: "ilanınız artık yayında ve kiralanabilir.",
  },
  REJECTED: {
    heading: "İlanınız reddedildi",
    body: "ilanınız maalesef reddedildi.",
  },
  PAUSED: {
    heading: "İlanınız duraklatıldı",
    body: "ilanınız duraklatıldı; ilanlarım sayfasından incelemeye yeniden gönderebilirsiniz.",
  },
};

/** İlan sahibine: ilan durumu değişikliği bildirimi. */
export function listingStatusChangedTemplate(
  to: string,
  data: ListingStatusChangedData,
): EmailMessage {
  const { heading, body } = LISTING_STATUS_TEXT[data.status];
  const lines = [`Sayın kullanıcımız, ${escapeHtml(data.listingTitle)} ${body}`];
  if (data.status === "REJECTED" && data.reason) {
    lines.push(`Gerekçe: ${escapeHtml(data.reason)}`);
  }
  return { to, subject: heading, html: layout(heading, lines) };
}

export interface RegisterVerifyData {
  verifyUrl: string;
  expiryHours: number;
}

/** Yeni üye: e-posta doğrulama bağlantısı. */
export function registerVerifyTemplate(
  to: string,
  data: RegisterVerifyData,
): EmailMessage {
  const heading = "E-posta adresinizi doğrulayın";
  return {
    to,
    subject: heading,
    html: layout(heading, [
      "Sayın kullanıcımız,",
      "Karavan Kiralama platformuna kaydınız alındı. Hesabınızı aktif etmek için aşağıdaki bağlantıya tıklayın:",
      `<p style="font-size: 15px;"><a href="${escapeHtml(data.verifyUrl)}" style="color: #2563eb;">${escapeHtml(data.verifyUrl)}</a></p>`,
      `Bu bağlantı ${data.expiryHours} saat boyunca geçerlidir.`,
      "Bağlantı çalışmıyorsa, tarayıcınıza kopyalayıp yapıştırın.",
      "Bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.",
    ]),
  };
}

/** Günlük özette (T9) listelenecek en fazla sohbet sayısı. */
export const DIGEST_MAX_CONVERSATIONS = 5;

/** Önizlemenin e-postaya sığdığı üst sınır (karakter). */
const DIGEST_PREVIEW_MAX = 140;

export interface DigestConversationData {
  id: string;
  listingTitle: string;
  preview: string;
  unreadCount: number;
  /** Sohbetin mesajlar sayfası: `/hesap/mesajlar/{id}`. */
  url: string;
}

export interface DailyDigestData {
  userName: string;
  conversations: DigestConversationData[];
}

/** Önizleme metni: satır sonlarını/kısa boşlukları sıkıştırır, uzunsa kısaltır. */
function previewText(value: string): string {
  const collapsed = value.replaceAll(/\s+/g, " ").trim();
  if (collapsed.length <= DIGEST_PREVIEW_MAX) {
    return collapsed;
  }
  return `${collapsed.slice(0, DIGEST_PREVIEW_MAX).trimEnd()}…`;
}

/**
 * Günlük mesaj özeti (T9): okunmamış sohbetleri tek e-postada listeler —
 * ilan başlığı, son mesaj önizlemesi, okunmamış sayısı ve "Mesajları gör"
 * bağlantısı. Liste en fazla `DIGEST_MAX_CONVERSATIONS` sohbeti gösterir.
 */
export function dailyDigestTemplate(
  to: string,
  data: DailyDigestData,
): EmailMessage {
  const heading = "Günlük mesaj özetiniz";
  const conversations = data.conversations.slice(0, DIGEST_MAX_CONVERSATIONS);
  const lines = [
    `Sayın ${escapeHtml(data.userName)},`,
    "Karavan Kiralama platformunda okumadığınız mesajlar var. İşte günlük özetiniz:",
  ];

  if (conversations.length === 0) {
    lines.push("Şu anda okunmamış mesajınız bulunmuyor.");
  }
  for (const conversation of conversations) {
    lines.push(
      `<strong>${escapeHtml(conversation.listingTitle)}</strong> — ${conversation.unreadCount} okunmamış mesaj<br />` +
        `&ldquo;${escapeHtml(previewText(conversation.preview))}&rdquo;<br />` +
        `<a href="${escapeHtml(conversation.url)}" style="color: #2563eb;">Mesajları gör</a>`,
    );
  }

  lines.push(
    "Tüm sohbetlerinizi hesabınızdaki mesajlar sayfasından görebilirsiniz.",
  );
  return { to, subject: heading, html: layout(heading, lines) };
}
