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
    body: "ilanınız duraklatıldı; dilediğinizde tekrar yayına alabilirsiniz.",
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
