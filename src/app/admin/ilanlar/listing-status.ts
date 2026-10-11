import type { ListingStatus } from "@prisma/client";

// Admin ilan yüzeyleri paylaşır: kuyruk + detay önizleme.
// Arayüz metni Türkçe, DB değeri İngilizce (hesap/ilanlarim ile aynı kalıp).

export const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "İncelemede",
  ACTIVE: "Yayında",
  REJECTED: "Reddedildi",
  PAUSED: "Duraklatıldı",
};

export const STATUS_BADGES: Record<ListingStatus, string> = {
  DRAFT: "badge badge-neutral",
  PENDING: "badge badge-warning",
  ACTIVE: "badge badge-success",
  REJECTED: "badge badge-error",
  PAUSED: "badge badge-info",
};
