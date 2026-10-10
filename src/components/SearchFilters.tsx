import { VEHICLE_TYPE_OPTIONS } from "../lib/labels";

// Genel arama filtre formu — saf HTML GET (method="get" action="/arama").
// JS zorunlu değil: tarayıcı doğrudan /arama?... navigasyonu yapar; boş
// alanlar URL'ye boş değer olarak yazılır (parseSearchParams boşu yok sayar).
// / ve /arama sayfalarında aynı bileşen kullanılır (URL round-trip).

export type SearchFilterValues = {
  sehir: string;
  baslangic: string;
  bitis: string;
  kisi: string;
  minFiyat: string;
  maxFiyat: string;
  aracTipi: string;
};

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

const labelClassName = "block text-sm font-medium text-gray-700";

export function SearchFilters({
  initial,
}: {
  /** URL query'den gelen mevcut değerler (arama sayfasında formu korur). */
  initial?: Partial<SearchFilterValues>;
}) {
  return (
    <form
      method="get"
      action="/arama"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label htmlFor="search-sehir" className={labelClassName}>
          Şehir
        </label>
        <input
          id="search-sehir"
          name="sehir"
          type="text"
          defaultValue={initial?.sehir ?? ""}
          placeholder="Antalya"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-baslangic" className={labelClassName}>
          Giriş tarihi
        </label>
        <input
          id="search-baslangic"
          name="baslangic"
          type="date"
          defaultValue={initial?.baslangic ?? ""}
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-bitis" className={labelClassName}>
          Çıkış tarihi
        </label>
        <input
          id="search-bitis"
          name="bitis"
          type="date"
          defaultValue={initial?.bitis ?? ""}
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-kisi" className={labelClassName}>
          Kişi
        </label>
        <input
          id="search-kisi"
          name="kisi"
          type="number"
          min={1}
          max={16}
          defaultValue={initial?.kisi ?? ""}
          placeholder="4"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-minfiyat" className={labelClassName}>
          Min gece fiyatı (₺)
        </label>
        <input
          id="search-minfiyat"
          name="minFiyat"
          type="number"
          min={0}
          defaultValue={initial?.minFiyat ?? ""}
          placeholder="500"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-maxfiyat" className={labelClassName}>
          Max gece fiyatı (₺)
        </label>
        <input
          id="search-maxfiyat"
          name="maxFiyat"
          type="number"
          min={0}
          defaultValue={initial?.maxFiyat ?? ""}
          placeholder="3000"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-aractipi" className={labelClassName}>
          Araç tipi
        </label>
        <select
          id="search-aractipi"
          name="aracTipi"
          defaultValue={initial?.aracTipi ?? ""}
          className={inputClassName}
        >
          <option value="">Tümü</option>
          {VEHICLE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Ara
        </button>
      </div>
    </form>
  );
}
