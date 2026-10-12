/**
 * Panel durum sekmeleri — saf veri ve query yardımcıları.
 *
 * Sekmeler URL query ile sürülür: sayfa `searchParams` okur, `parseTabValue`
 * ham değeri doğrular; `tabHref` sekme bağlantısını üretir. İstemci durumu
 * yoktur; geri tuşu ve paylaşılabilir link doğal olarak çalışır.
 */

/** Tek bir durum sekmesi: değer + etiket + sayaç. */
export type TabOption = {
  value: string;
  label: string;
  count: number;
};

/**
 * Ham query değerini izinli kümedeki bir sekmeye eşler.
 * - `undefined` / `""` / boş dizi → `fallback`.
 * - Dizi verilirse ilk değer kullanılır (ör. `?durum=a&durum=b`).
 * - İzinli kümede olmayan değer → `fallback`.
 */
export function parseTabValue(
  raw: string | string[] | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === "") {
    return fallback;
  }
  return allowed.includes(value) ? value : fallback;
}

/**
 * Sekme bağlantısı üretir.
 *
 * Mevcut query parametreleri (ör. `q`) korunur; yalnız `param` değiştirilir.
 * `value` boş metin (`""`) verilirse `param` tümüyle düşürülür — varsayılan
 * sekmenin temiz URL üretmesi için kullanılır.
 *
 * @param basePath yalnız yol (query içermez), ör. `/hesap/ilanlarim`
 * @param current mevcut query (URLSearchParams ya da düz kayıt)
 * @param param değiştirilecek query anahtarı, ör. `durum`
 * @param value yeni değer; `""` → parametreyi kaldır
 */
export function tabHref(
  basePath: string,
  current: URLSearchParams | Record<string, string | undefined>,
  param: string,
  value: string,
): string {
  const params =
    current instanceof URLSearchParams
      ? new URLSearchParams(current)
      : new URLSearchParams(
          Object.entries(current).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        );

  if (value === "") {
    params.delete(param);
  } else {
    params.set(param, value);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
