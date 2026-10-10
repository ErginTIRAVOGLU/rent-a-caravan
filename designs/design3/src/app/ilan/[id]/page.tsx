import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, BedDouble, Fuel, Gauge, MapPin, Ruler, UsersRound } from "lucide-react";
import { demoListings } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/utils";
import { DemoBanner } from "@/components/ui";
import { PhotoGallery } from "@/components/photo-gallery";
import { RequestForm } from "@/components/request-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = demoListings.find((item) => item.id === id);
  return { title: listing ? listing.title : "İlan bulunamadı" };
}

type DetailQuery = Record<string, string | string[] | undefined>;
const queryValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function ListingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<DetailQuery> }) {
  const { id } = await params;
  const query = await searchParams;
  const listing = demoListings.find((item) => item.id === id);
  if (!listing) notFound();
  const facts = [
    { icon: Gauge, label: "Vites", value: listing.transmission },
    { icon: Fuel, label: "Yakıt", value: listing.fuel },
    { icon: UsersRound, label: "Kapasite", value: `${listing.capacity} kişi` },
    { icon: BedDouble, label: "Yatak", value: `${listing.beds} yatak` },
    { icon: Ruler, label: "Ölçüler", value: listing.dimensions },
  ];
  return (
    <div className="page-container py-6 sm:py-10">
      <Link href="/arama" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-forest"><ArrowLeft size={16} /> Sonuçlara dön</Link>
      <div className="mb-5"><DemoBanner /></div>
      <PhotoGallery images={listing.gallery} title={listing.title} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <article>
          <div className="border-b border-line pb-6"><p className="inline-flex items-center gap-1.5 text-sm text-ink-muted"><MapPin size={16} /> {listing.district}, {listing.city} · {listing.vehicleType}</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{listing.title}</h1><p className="mt-3 text-sm leading-6 text-ink-muted">{listing.description}</p><span className="mt-4 inline-flex rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">Örnek ilan · Demo içerik</span></div>
          <section className="border-b border-line py-6"><h2 className="font-display text-xl font-bold text-ink">Karavan hakkında</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{facts.map(({ icon: Icon, label, value }) => <div key={label} className="rounded-2xl bg-white p-4"><Icon size={18} className="text-forest" /><p className="mt-3 text-xs text-ink-muted">{label}</p><p className="mt-1 text-sm font-bold text-ink">{value}</p></div>)}</div><p className="mt-4 text-sm leading-6 text-ink-muted">{listing.brand} {listing.model} · {listing.year} model · {listing.license} ehliyet · En az {listing.minimumDriverAge} yaş · Minimum {listing.minimumNights} gece</p></section>
          <section className="border-b border-line py-6"><h2 className="font-display text-xl font-bold text-ink">Öne çıkan donanımlar</h2><ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{listing.amenities.map((item) => <li key={item} className="flex min-h-10 items-center gap-2 text-sm text-ink-muted"><BadgeCheck size={16} className="shrink-0 text-forest" />{item}</li>)}</ul></section>
          <section className="border-b border-line py-6"><h2 className="font-display text-xl font-bold text-ink">Ev kuralları</h2><ul className="mt-4 grid gap-3">{listing.rules.map((rule) => <li key={rule} className="flex gap-3 text-sm leading-6 text-ink-muted"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{rule}</li>)}</ul></section>
          <section className="py-6"><h2 className="font-display text-xl font-bold text-ink">İlan sahibi</h2><div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-sage-pale font-display text-sm font-extrabold text-forest">{listing.hostInitials}</span><div><p className="font-bold text-ink">{listing.hostName}</p><p className="mt-1 text-xs text-ink-muted">Örnek profil · doğrulama bilgisi sunulmuyor</p></div></div></section>
        </article>
        <aside className="h-fit rounded-3xl border border-line bg-white p-5 shadow-soft lg:sticky lg:top-24 sm:p-6"><div className="mb-5 flex items-end justify-between gap-3"><div><strong className="font-display text-2xl font-extrabold text-ink">{formatCurrency(listing.nightlyPrice)}</strong><span className="text-sm text-ink-muted"> / gece</span></div><span className="rounded-full bg-sage-pale px-3 py-1 text-xs font-bold text-forest">{listing.minimumNights} gece min.</span></div><div className="mb-5 rounded-xl border border-warning-line bg-warning-soft px-3.5 py-3 text-xs leading-5 text-warning">Talep göndermek ödeme değildir. Bu örnek form kalıcı rezervasyon oluşturmaz.</div><RequestForm listing={listing} initialStart={queryValue(query.baslangic)} initialEnd={queryValue(query.bitis)} initialPersons={queryValue(query.kisi)} /></aside>
      </div>
    </div>
  );
}
