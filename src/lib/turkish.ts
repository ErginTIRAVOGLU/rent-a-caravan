/**
 * Türkçe büyük/küçük harf katlaması.
 *
 * Varsayılan `String.prototype.toLowerCase()` dil bağımsızdır: "İ" harfini
 * "i" + birleşik nokta (U+0307) yapar, bu yüzden `"İlan".toLowerCase()` →
 * `"i̇lan"` olur ve `"ilan"` araması eşleşmez. `tr` yerel ayarı ile "İ" → "i"
 * (tek karakter) olur; iki taraf da bu yardımcıdan geçtiğinde karşılaştırma
 * tutarlı kalır.
 */
export function foldTurkish(value: string): string {
  return value.toLocaleLowerCase("tr");
}
