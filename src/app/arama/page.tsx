import type { Metadata } from "next";
import Link from "next/link";

import { ListingCard } from "../../components/ListingCard";
import { SearchFilters } from "../../components/SearchFilters";
import { VEHICLE_TYPE_LABELS } from "../../lib/labels";
import {
  SEARCH_PAGE_SIZE,
  parseSearchParams,
  searchListings,
} from "../../server/listings/search";

export const metadata: Metadata = {
  title: "Arama Sonuçları — Karavan Kiralama",
};

// Arama sonuçları — sunucu bileşeni: filtreler URL query'den okunur,
// sonuçlar + sayfalama aynı query'yi korur (round-trip).

type RawQuery = Record<string, string | string[] | undefined>;

const FILTER_KEYS = [
  "sehir",
  "baslangic",
  "bitis",
  "kisi",
  "minFiyat",
  "maxFiyat",
  "aracTipi",
] as const;

/** Tekrarlı query parametresinde ilk değer; yoksa boş string. */
function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Mevcut filtreleri koruyarak sayfa linki üretir (sayfa=1 URL'den düşer). */
function pageHref(query: RawQuery, page: number): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = firstValue(query[key]);
    if (value !== "") {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set("sayfa", String(page));
  }
  const qs = params.toString();
  return qs ? `/arama?${qs}` : "/arama";
}

/** Belirli filtreyi URL'den düşerek "x" ile kaldırma linki üretir. */
function withoutFilter(query: RawQuery, drop: (typeof FILTER_KEYS)[number]): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (key === drop) continue;
    const value = firstValue(query[key]);
    if (value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `/arama?${qs}` : "/arama";
}

/** Uygulanan filtrelerin görünen etiketleri (chip'ler). */
function activeFilterChips(query: RawQuery): Array<{
  key: (typeof FILTER_KEYS)[number];
  label: string;
}> {
  const chips: Array<{ key: (typeof FILTER_KEYS)[number]; label: string }> = [];
  for (const key of FILTER_KEYS) {
    const value = firstValue(query[key]);
    if (value === "") continue;
    switch (key) {
      case "sehir":
        chips.push({ key, label: `Şehir: ${value}` });
        break;
      case "baslangic":
        chips.push({ key, label: `Giriş: ${value}` });
        break;
      case "bitis":
        chips.push({ key, label: `Çıkış: ${value}` });
        break;
      case "kisi":
        chips.push({ key, label: `${value} kişi` });
        break;
      case "minFiyat":
        chips.push({ key, label: `Min ₺${value}` });
        break;
      case "maxFiyat":
        chips.push({ key, label: `Max ₺${value}` });
        break;
      case "aracTipi":
        chips.push({
          key,
          label: VEHICLE_TYPE_LABELS[value as keyof typeof VEHICLE_TYPE_LABELS] ?? value,
        });
        break;
    }
  }
  return chips;
}

const pageLinkClassName =
  "inline-flex min-h-10 items-center rounded-lg border border-outline-variant bg-white px-4 py-2 text-label-lg text-primary hover:bg-surface-low disabled:opacity-50";

export default async function AramaPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>;
}) {
  const query = await searchParams;
  const parsed = parseSearchParams(query);
  const { items, total } = await searchListings(query);

  const page = parsed.page;
  const totalPages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const hasResults = items.length > 0;
  // sayfa=99 gibi sınırdışı bir değer: geçmiş linki son geçerli sayfaya gider.
  const prevPage = page > totalPages ? totalPages : page - 1;

  // Form ilk değerleri: ham query'den (geçersiz değerler de forma geri yazılır).
  const initial = {
    sehir: firstValue(query.sehir),
    baslangic: firstValue(query.baslangic),
    bitis: firstValue(query.bitis),
    kisi: firstValue(query.kisi),
    minFiyat: firstValue(query.minFiyat),
    maxFiyat: firstValue(query.maxFiyat),
    aracTipi: firstValue(query.aracTipi),
  };

  const chips = activeFilterChips(query);
  const sehir = firstValue(query.sehir);
  const headline =
    total === 0
      ? "Eşleşen karavan bulunamadı"
      : `${sehir ? `${sehir} için ` : ""}${total} karavan bulundu`;

  // Fiyat özeti yalnız doğrulanmış (parsed) tarihlerle kurulur — ham query'den
  // gelen geçersiz tarih kart linklerine taşınmaz.
  const stay =
    parsed.baslangic && parsed.bitis
      ? { baslangic: parsed.baslangic, bitis: parsed.bitis }
      : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-12">
      {/* Başlık */}
      <p className="eyebrow">Karavanları keşfet</p>
      <h1
        className="mt-1 text-headline-lg font-bold text-primary"
        aria-live="polite"
      >
        {headline}
        {total > 0 && page > 1 ? (
          <span className="text-on-surface-variant">
            {" "}
            · sayfa {page}/{totalPages}
          </span>
        ) : null}
      </h1>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Seçtiğiniz tarih, kişi ve fiyat filtreleriyle eşleşen ilanlar.
      </p>

      {/* Aktif filtre chip'leri */}
      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-label-md text-on-surface-variant">
            Filtreler:
          </span>
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={withoutFilter(query, chip.key)}
              className="chip border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              title="Bu filtreyi kaldır"
            >
              {chip.label}
              <span className="material-symbols-outlined text-base">
                close
              </span>
            </Link>
          ))}
          <Link
            href="/arama"
            className="text-label-md text-on-surface-variant underline hover:text-primary"
          >
            Filtreleri temizle
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        {/* Sol: detaylı filtreler */}
        <aside>
          <div className="card p-5 lg:sticky lg:top-24">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-title-md font-bold text-primary">
                <span className="material-symbols-outlined text-xl text-accent">
                  tune
                </span>
                Detaylı Filtreler
              </h2>
              {chips.length > 0 ? (
                <span className="badge badge-accent">{chips.length} aktif</span>
              ) : null}
            </div>
            <SearchFilters
              initial={initial}
              layout="stack"
              submitLabel="Sonuçları Güncelle"
            />
          </div>
        </aside>

        {/* Sağ: sonuçlar */}
        <div>
          {!hasResults && total === 0 ? (
            <div className="card p-10 text-center">
              <span className="material-symbols-outlined text-4xl text-outline">
                search_off
              </span>
              <p className="mt-3 font-bold text-on-surface">
                Sonuç bulunamadı
              </p>
              <p className="mt-1 text-body-md text-on-surface-variant">
                Filtreleri gevşetmeyi (tarih veya fiyat aralığını genişletmeyi)
                deneyin.
              </p>
            </div>
          ) : !hasResults ? (
            /* sayfa sayısı aşıldı (ör. ?sayfa=99) */
            <div className="card p-10 text-center">
              <p className="text-body-md text-on-surface-variant">
                Bu sayfada ilan yok.
              </p>
              <Link
                href={pageHref(query, 1)}
                className="btn btn-outline btn-sm mt-4"
              >
                İlk sayfaya dön
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} stay={stay} />
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav
              className="mt-8 flex items-center justify-center gap-3"
              aria-label="Sayfalama"
            >
              {prevPage >= 1 ? (
                <Link
                  href={pageHref(query, prevPage)}
                  rel="prev"
                  className={pageLinkClassName}
                >
                  ← Önceki
                </Link>
              ) : (
                <span className={`${pageLinkClassName} cursor-default`}>
                  ← Önceki
                </span>
              )}
              <span className="text-body-md text-on-surface-variant">
                Sayfa {Math.min(page, totalPages)} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(query, page + 1)}
                  rel="next"
                  className={pageLinkClassName}
                >
                  Sonraki →
                </Link>
              ) : (
                <span className={`${pageLinkClassName} cursor-default`}>
                  Sonraki →
                </span>
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
