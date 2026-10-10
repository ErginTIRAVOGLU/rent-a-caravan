import type { Metadata } from "next";
import Link from "next/link";

import { ListingCard } from "../../components/ListingCard";
import { SearchFilters } from "../../components/SearchFilters";
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

const gridClassName =
  "mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";
const pageLinkClassName =
  "inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-emerald-400 disabled:opacity-50";

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

  // Fiyat özeti yalnız doğrulanmış (parsed) tarihlerle kurulur — ham query'den
  // gelen geçersiz tarih kart linklerine taşınmaz.
  const stay =
    parsed.baslangic && parsed.bitis
      ? { baslangic: parsed.baslangic, bitis: parsed.bitis }
      : undefined;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center text-lg font-bold text-emerald-700 hover:text-emerald-800"
          >
            Karavan Kiralama
          </Link>
          <Link
            href="/giris"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-gray-700 hover:text-emerald-700"
          >
            Giriş Yap
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <SearchFilters initial={initial} />
        </div>

        <p className="mt-5 text-sm text-gray-600" aria-live="polite">
          {total === 0
            ? "Eşleşen ilan bulunamadı."
            : `${total} ilan bulundu${
                page > 1 ? ` · sayfa ${page}/${totalPages}` : ""
              }`}
        </p>

        {!hasResults && total === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="font-semibold text-gray-900">
              Sonuç bulunamadı
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Filtreleri gevşetmeyi (tarih veya fiyat aralığını genişletmeyi)
              deneyin.
            </p>
          </div>
        ) : !hasResults ? (
          /* sayfa sayısı aşıldı (ör. ?sayfa=99) */
          <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">Bu sayfada ilan yok.</p>
            <Link
              href={pageHref(query, 1)}
              className="mt-3 inline-block font-semibold text-emerald-700 hover:underline"
            >
              İlk sayfaya dön →
            </Link>
          </div>
        ) : (
          <ul className={gridClassName}>
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} stay={stay} />
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <nav
            className="mt-6 flex items-center justify-center gap-3"
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
            <span className="text-sm text-gray-600">
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
    </main>
  );
}
