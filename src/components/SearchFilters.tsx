import type { ReactNode } from "react";

import { VEHICLE_TYPE_OPTIONS } from "../lib/labels";

// Genel arama filtre formu — saf HTML GET (method="get" action="/arama").
// JS zorunlu değil: tarayıcı doğrudan /arama?... navigasyonu yapar; boş
// alanlar URL'ye boş değer olarak yazılır (parseSearchParams boşu yok sayar).
// / (grid, turuncu "Karavan Ara") ve /arama (stack, lacivert "Sonuçları
// Güncelle") aynı bileşeni farklı yerleşimle kullanır (URL round-trip).

export type SearchFilterValues = {
  sehir: string;
  baslangic: string;
  bitis: string;
  kisi: string;
  minFiyat: string;
  maxFiyat: string;
  aracTipi: string;
};

type SearchFiltersProps = {
  /** URL query'den gelen mevcut değerler (arama sayfasında formu korur). */
  initial?: Partial<SearchFilterValues>;
  /** grid: ana sayfa hero kartı (2 satır) · stack: arama filtre paneli (dikey). */
  layout?: "grid" | "stack";
  submitLabel?: string;
  submitVariant?: "accent" | "primary";
};

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label flex items-center gap-1.5">
        <span className="material-symbols-outlined text-base text-secondary">
          {icon}
        </span>
        {label}
      </label>
      {children}
    </div>
  );
}

export function SearchFilters({
  initial,
  layout = "grid",
  submitLabel = "Ara",
  submitVariant = "primary",
}: SearchFiltersProps) {
  const formClassName =
    layout === "stack"
      ? "space-y-4"
      : "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4";
  const buttonClassName =
    submitVariant === "accent" ? "btn btn-accent w-full" : "btn btn-primary w-full";

  const fields: Array<{
    id: string;
    name: keyof SearchFilterValues;
    label: string;
    icon: string;
    type: string;
    placeholder?: string;
    min?: number;
    max?: number;
  }> = [
    { id: "search-sehir", name: "sehir", label: "Şehir", icon: "location_on", type: "text", placeholder: "Antalya" },
    { id: "search-baslangic", name: "baslangic", label: "Giriş tarihi", icon: "calendar_month", type: "date" },
    { id: "search-bitis", name: "bitis", label: "Çıkış tarihi", icon: "calendar_month", type: "date" },
    { id: "search-kisi", name: "kisi", label: "Kişi", icon: "persons", type: "number", placeholder: "4", min: 1, max: 16 },
    { id: "search-minfiyat", name: "minFiyat", label: "Min gece fiyatı (₺)", icon: "payments", type: "number", placeholder: "500", min: 0 },
    { id: "search-maxfiyat", name: "maxFiyat", label: "Max gece fiyatı (₺)", icon: "payments", type: "number", placeholder: "3000", min: 0 },
  ];

  return (
    <form method="get" action="/arama" className={formClassName}>
      {fields.map((field) => (
        <Field key={field.id} id={field.id} label={field.label} icon={field.icon}>
          <input
            id={field.id}
            name={field.name}
            type={field.type}
            min={field.min}
            max={field.max}
            defaultValue={initial?.[field.name] ?? ""}
            placeholder={field.placeholder}
            className="input"
          />
        </Field>
      ))}

      <Field id="search-aractipi" label="Araç tipi" icon="time_to_leave">
        <select
          id="search-aractipi"
          name="aracTipi"
          defaultValue={initial?.aracTipi ?? ""}
          className="input"
        >
          <option value="">Tümü</option>
          {VEHICLE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <div className={layout === "stack" ? "" : "flex items-end"}>
        <button type="submit" className={buttonClassName}>
          <span className="material-symbols-outlined text-lg">search</span>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
