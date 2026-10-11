// Para biçimi — tek kaynak. Kuruşlu ondalıklar (Decimal(10,2)) bilimsel
// gösterime kaymasın diye tüm ₺ display'leri buradan geçer.

const TRY_FORMAT = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

/** Tutarı ₺ biçiminde Türkçe gösterir (ör. "4.500 ₺"). */
export function formatTRY(amount: number): string {
  return TRY_FORMAT.format(amount);
}

/** Geçen süreyi Türkçe göreli zaman olarak gösterir (ör. "5 dk önce", "2 sa önce", "10.01.2026"). */
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHour < 24) return `${diffHour} sa önce`;
  if (diffDay < 7) return `${diffDay} gün önce`;

  // 7 günden eski: tam tarih
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
