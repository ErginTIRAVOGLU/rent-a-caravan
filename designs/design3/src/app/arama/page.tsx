import type { Metadata } from "next";
import { Search } from "lucide-react";
import { demoListings, hasDemoDateConflict } from "@/lib/demo-data";
import { formatCurrency, formatDate, rentalDays } from "@/lib/utils";
import { ListingCard } from "@/components/listing-card";
import { Pagination } from "@/components/pagination";
import { SearchFilters } from "@/components/search-filters";
import { SearchForm } from "@/components/search-form";
import { Badge, Button, DemoBanner, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Karavan ara" };

type Query = Record<string, string | string[] | undefined>;
const valueOf = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const city = valueOf(query.sehir).trim();
  const type = valueOf(query.tip);
  const min = Number(valueOf(query.min)) || 0;
  const max = Number(valueOf(query.max)) || Number.POSITIVE_INFINITY;
  const persons = Number(valueOf(query.kisi)) || 0;
  const startDate = valueOf(query.baslangic);
  const endDate = valueOf(query.bitis);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const page = Math.max(1, Number(valueOf(query.sayfa)) || 1);
  const sort = valueOf(query.siralama) || "recommended";
  const normalizedCity = city.toLocaleLowerCase("tr-TR");
  const dateRangeInvalid = Boolean(startDate && endDate && startDate >= endDate);
  const dateRangeInPast = Boolean(startDate && startDate < today);
  let results = (dateRangeInvalid || dateRangeInPast ? [] : demoListings).filter((listing) =>
    (!normalizedCity || `${listing.city} ${listing.district}`.toLocaleLowerCase("tr-TR").includes(normalizedCity)) &&
    (!type || listing.vehicleType === type) &&
    listing.nightlyPrice >= min && listing.nightlyPrice <= max &&
    (!persons || listing.capacity >= persons) &&
    (!startDate || !endDate || (rentalDays(startDate, endDate) >= listing.minimumNights && !hasDemoDateConflict(listing.id, startDate, endDate))),
  );
  if (sort === "price-asc") results = [...results].sort((a, b) => a.nightlyPrice - b.nightlyPrice);
  if (sort === "price-desc") results = [...results].sort((a, b) => b.nightlyPrice - a.nightlyPrice);

  const perPage = 2;
  const totalPages = Math.max(1, Math.ceil(results.length / perPage));
  const safePage = Math.min(page, totalPages);
  const visible = results.slice((safePage - 1) * perPage, safePage * perPage);
  const queryString = new URLSearchParams(Object.entries(query).flatMap(([key, raw]) => {
    const value = valueOf(raw);
    return value && key !== "sayfa" ? [[key, value]] : [];
  })).toString();
  const chips = [
    city ? `Konum: ${city}` : "",
    startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : startDate ? `Başlangıç: ${formatDate(startDate)}` : endDate ? `Bitiş: ${formatDate(endDate)}` : "",
    type,
    min ? `En az ${formatCurrency(min)}` : "",
    Number.isFinite(max) ? `En çok ${formatCurrency(max)}` : "",
    persons ? `${persons}+ kişi` : "",
  ].filter(Boolean);

  return (
    <div className="page-container py-8 sm:py-12">
      <div className="mb-6"><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-sage-strong">Karavan arama</p><h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Bir sonraki rotanı bul</h1><p className="mt-2 text-sm text-ink-muted">Şehir, tarih ve araç özelliklerine göre örnek ilanları keşfet.</p></div>
      <SearchForm variant="compact" values={{ city, startDate, endDate, persons: valueOf(query.kisi) }} />
      <DemoBanner className="mt-5" />
      {dateRangeInvalid ? <p className="mt-4 rounded-xl border border-error/20 bg-error-soft px-4 py-3 text-sm text-error" role="alert">Çıkış tarihi giriş tarihinden sonra olmalı.</p> : null}
      {dateRangeInPast ? <p className="mt-4 rounded-xl border border-error/20 bg-error-soft px-4 py-3 text-sm text-error" role="alert">Geçmiş bir giriş tarihi için uygunluk aranamaz.</p> : null}
      {Boolean(startDate) !== Boolean(endDate) ? <p className="mt-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info" role="status">Tarih filtresini uygulamak için hem giriş hem çıkış tarihi seç.</p> : null}
      <div className="mt-8 grid gap-7 lg:grid-cols-[250px_1fr]">
        <SearchFilters values={{ city, type, min: valueOf(query.min), max: valueOf(query.max), persons: valueOf(query.kisi) }} />
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="font-display text-xl font-bold text-ink">{results.length} örnek sonuç</h2>{chips.length ? <div className="mt-2 flex flex-wrap gap-2">{chips.map((chip) => <Badge key={chip} tone="info">{chip}</Badge>)}<a className="inline-flex min-h-11 items-center px-2 text-xs font-bold text-forest underline underline-offset-4" href="/arama">Temizle</a></div> : null}</div>
            <form action="/arama" method="get" className="flex items-center gap-2 text-sm text-ink-muted">
              {Object.entries(query).filter(([key, raw]) => key !== "siralama" && key !== "sayfa" && valueOf(raw)).map(([key, raw]) => <input key={key} type="hidden" name={key} value={valueOf(raw)} />)}
              <label htmlFor="sort-results" className="whitespace-nowrap">Sırala</label><select id="sort-results" name="siralama" defaultValue={sort} className="min-h-11 rounded-full border border-line bg-white px-3 text-xs font-bold text-ink"><option value="recommended">Önerilen</option><option value="price-asc">Fiyat: düşükten yükseğe</option><option value="price-desc">Fiyat: yüksekten düşüğe</option></select><Button type="submit" size="sm" variant="outline">Uygula</Button>
            </form>
          </div>
          {visible.length ? <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2">{visible.map((listing) => <ListingCard key={listing.id} listing={listing} compact searchQuery={queryString} />)}</div> : <EmptyState title="Bu ölçütlerde ilan bulamadık" description="Filtreleri genişletip tekrar deneyebilir veya tüm örnek ilanlara dönebilirsin." action={<a href="/arama" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white"><Search size={16} /> Tüm ilanları gör</a>} />}
          {visible.length ? <Pagination page={safePage} totalPages={totalPages} query={queryString} /> : null}
        </section>
      </div>
      <p className="mt-8 text-xs leading-5 text-ink-muted">Fiyatlar ve ilan detayları örnek amaçlıdır. Bu demo arayüzü rezervasyon veya ödeme işlemi yapmaz.</p>
    </div>
  );
}
