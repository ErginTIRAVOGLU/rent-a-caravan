"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { VEHICLE_TYPE_OPTIONS } from "../lib/labels";

// Genel arama filtresi — GET navigasyonu (router.push + URL query).
// Boş alanlar URL'ye yazılmaz; yeni arama `sayfa`'yı sıfırlar (URL'de yok).
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

const EMPTY: SearchFilterValues = {
  sehir: "",
  baslangic: "",
  bitis: "",
  kisi: "",
  minFiyat: "",
  maxFiyat: "",
  aracTipi: "",
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
  const router = useRouter();
  const [form, setForm] = useState<SearchFilterValues>({
    ...EMPTY,
    ...initial,
  });

  function setField<K extends keyof SearchFilterValues>(
    name: K,
    value: SearchFilterValues[K],
  ) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      const trimmed = value.trim();
      if (trimmed !== "") {
        params.set(key, trimmed);
      }
    }
    const query = params.toString();
    router.push(query ? `/arama?${query}` : "/arama");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label htmlFor="search-sehir" className={labelClassName}>
          Şehir
        </label>
        <input
          id="search-sehir"
          type="text"
          value={form.sehir}
          onChange={(e) => setField("sehir", e.target.value)}
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
          type="date"
          value={form.baslangic}
          onChange={(e) => setField("baslangic", e.target.value)}
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-bitis" className={labelClassName}>
          Çıkış tarihi
        </label>
        <input
          id="search-bitis"
          type="date"
          value={form.bitis}
          onChange={(e) => setField("bitis", e.target.value)}
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="search-kisi" className={labelClassName}>
          Kişi
        </label>
        <input
          id="search-kisi"
          type="number"
          min={1}
          max={16}
          value={form.kisi}
          onChange={(e) => setField("kisi", e.target.value)}
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
          type="number"
          min={0}
          value={form.minFiyat}
          onChange={(e) => setField("minFiyat", e.target.value)}
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
          type="number"
          min={0}
          value={form.maxFiyat}
          onChange={(e) => setField("maxFiyat", e.target.value)}
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
          value={form.aracTipi}
          onChange={(e) => setField("aracTipi", e.target.value)}
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
