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
