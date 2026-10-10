import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AMENITIES } from "../../../lib/amenities";
import { getSessionUser } from "../../../lib/auth";
import {
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_TYPE_LABELS,
} from "../../../lib/labels";
import { prisma } from "../../../lib/prisma";
import { calculateNights, calculateTotalPrice } from "../../../lib/pricing";
import { parseSearchParams } from "../../../server/listings/search";
import { PhotoGallery } from "../../../components/PhotoGallery";
import { BookingRequestForm } from "./BookingRequestForm";

// İlan detayı — genel okuma yüzeyi: yalnız ACTIVE ilanlar görünür
// (sahip/admin bypass bu görevde YOK; sahipleri kendi ilanını hesabından görür).

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, status: true },
  });
  if (!listing || listing.status !== "ACTIVE") {
    return { title: "İlan Bulunamadı — Karavan Kiralama" };
  }
  return { title: `${listing.title} — Karavan Kiralama` };
}

const cardClassName = "rounded-2xl bg-white p-4 shadow-sm sm:p-6";
const sectionTitleClassName = "text-lg font-semibold text-gray-900";

/** Özet satırı (dl). */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

export default async function IlanDetayPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.status !== "ACTIVE") {
    notFound();
  }

  const user = await getSessionUser();
  const nightlyPrice = Number(listing.nightlyPrice);

  // Konaklama tarihleri URL'den (search.ts ile AYNI doğrulama — ikisi birlikte
  // ve baslangic < bitis geçerliyse fiyat özeti gösterilir).
  const parsed = parseSearchParams(query);
  const stayNights =
    parsed.baslangic && parsed.bitis
      ? calculateNights(parsed.baslangic, parsed.bitis)
      : null;
  const stayTotal =
    stayNights !== null
      ? Number(calculateTotalPrice(stayNights, listing.nightlyPrice))
      : null;

  const location = [listing.city, listing.district].filter(Boolean).join(" · ");
  const brandModel = [listing.brand, listing.model].filter(Boolean).join(" ");
  const amenityLabels = listing.amenities
    .map((key) => AMENITIES.find((a) => a.key === key)?.label ?? key)
    .filter((label, index, all) => all.indexOf(label) === index);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center text-lg font-bold text-emerald-700 hover:text-emerald-800"
          >
            Karavan Kiralama
          </Link>
          <Link
            href="/arama"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-gray-700 hover:text-emerald-700"
          >
            ← Aramaya dön
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <PhotoGallery photoUrls={listing.photoUrls} title={listing.title} />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Sol: içerik */}
          <div className="space-y-6 lg:col-span-2">
            <section className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {listing.title}
                  </h1>
                  <p className="mt-1 text-gray-600">{location}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {VEHICLE_TYPE_LABELS[listing.vehicleType]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
                  Ehliyet: {listing.licenseRequired}
                </span>
                {listing.minDriverAge !== null ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
                    Min. sürücü yaşı: {listing.minDriverAge}
                  </span>
                ) : null}
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
                  {listing.capacity} kişi
                </span>
              </div>
            </section>

            <section className={cardClassName}>
              <h2 className={sectionTitleClassName}>Özellikler</h2>
              <dl className="mt-2 divide-y divide-gray-100">
                <Row
                  label="Araç tipi"
                  value={VEHICLE_TYPE_LABELS[listing.vehicleType]}
                />
                {brandModel ? <Row label="Marka / Model" value={brandModel} /> : null}
                <Row
                  label="Vites"
                  value={TRANSMISSION_LABELS[listing.transmission]}
                />
                <Row label="Yakıt" value={FUEL_LABELS[listing.fuel]} />
                <Row label="Kapasite" value={`${listing.capacity} kişi`} />
                <Row
                  label="Minimum kiralama"
                  value={`${listing.minRentalDays} gün`}
                />
                {listing.year !== null ? (
                  <Row label="Üretim yılı" value={String(listing.year)} />
                ) : null}
                {listing.weightKg !== null ? (
                  <Row label="Ağırlık" value={`${listing.weightKg} kg`} />
                ) : null}
                {listing.lengthM !== null ? (
                  <Row label="Uzunluk" value={`${listing.lengthM} m`} />
                ) : null}
              </dl>
            </section>

            <section className={cardClassName}>
              <h2 className={sectionTitleClassName}>Açıklama</h2>
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-gray-700">
                {listing.description}
              </p>
            </section>

            <section className={cardClassName}>
              <h2 className={sectionTitleClassName}>Olanaklar</h2>
              {amenityLabels.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  Bu ilan için olanak belirtilmemiş.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {amenityLabels.map((label) => (
                    <li
                      key={label}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {listing.houseRules ? (
              <section className={cardClassName}>
                <h2 className={sectionTitleClassName}>Ev kuralları</h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-gray-700">
                  {listing.houseRules}
                </p>
              </section>
            ) : null}

            <section className={cardClassName}>
              <h2 className={sectionTitleClassName}>Yorumlar</h2>
              <p className="mt-2 text-sm text-gray-500">Henüz yorum yok.</p>
            </section>
          </div>

          {/* Sağ: fiyat özeti + talep */}
          <aside className="lg:col-span-1">
            <div className="space-y-4 lg:sticky lg:top-6">
              <section className={cardClassName}>
                {stayNights !== null && stayTotal !== null ? (
                  <div>
                    <p className="text-sm text-gray-600">
                      {parsed.baslangic} → {parsed.bitis}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      {nightlyPrice} ₺ × {stayNights} gece
                    </p>
                    <p className="mt-1">
                      <span className="text-xl font-bold text-gray-900">
                        {stayTotal} ₺
                      </span>
                      <span className="text-sm text-gray-500"> toplam</span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <p>
                      <span className="text-2xl font-bold text-gray-900">
                        {nightlyPrice} ₺
                      </span>
                      <span className="text-sm text-gray-500"> / gece</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {listing.minRentalDays} gün minimum kiralama
                    </p>
                  </div>
                )}

                {/* Talep formu (T9): oturum yoksa giriş çağrısı, sahipse not. */}
                {user ? (
                  user.id === listing.ownerId ? (
                    <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                      <p>Bu sizin ilanınız; kendi ilanınıza talep oluşturamazsınız.</p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <BookingRequestForm
                        listingId={listing.id}
                        minRentalDays={listing.minRentalDays}
                        capacity={listing.capacity}
                        nightlyPrice={nightlyPrice}
                      />
                    </div>
                  )
                ) : (
                  <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                    <p>
                      Talep göndermek için{" "}
                      <Link
                        href="/giris"
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        giriş yapın
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
