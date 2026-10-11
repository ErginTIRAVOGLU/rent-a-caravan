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
import { formatTRY } from "../../../lib/format";
import { validateStay } from "../../../lib/stay";
import { parseSearchParams } from "../../../server/listings/search";
import { getReviewsForListing } from "../../../server/reviews/service";
import { PhotoGallery } from "../../../components/PhotoGallery";
import { ReportDialog } from "../../../components/ReportDialog";
import { StarRating } from "../../../components/StarRating";
import { BookingRequestForm } from "./BookingRequestForm";
import { AskButton } from "./AskButton";

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

const cardClassName = "card p-5 sm:p-6";
const sectionTitleClassName =
  "flex items-center gap-2 text-title-md font-bold text-primary";

/** Özet satırı (dl). */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-body-md text-on-surface-variant">{label}</dt>
      <dd className="text-right text-body-md font-semibold text-on-surface">
        {value}
      </dd>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: string }) {
  return (
    <h2 className={sectionTitleClassName}>
      <span className="material-symbols-outlined text-xl text-accent">
        {icon}
      </span>
      {children}
    </h2>
  );
}

export default async function IlanDetayPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: { select: { name: true } } },
  });
  if (!listing || listing.status !== "ACTIVE") {
    notFound();
  }

  const user = await getSessionUser();
  const nightlyPrice = Number(listing.nightlyPrice);

  // Yorumlar + ortalama puan (display guard'lar service'te uygulanır:
  // reviewsEnabled=false veya owner reviewsVisible=false → boş döner).
  const reviewsResult = await getReviewsForListing(id);
  const reviewsData = reviewsResult.ok ? reviewsResult.data : null;

  // "Değerlendir" kapısı — yorum-yaz sayfasıyla AYNI kural:
  // yalnız COMPLETED + kendi booking'i + mevcut yorum yok. Sahibe yok.
  let canReview = false;
  if (user && user.id !== listing.ownerId) {
    const booking = await prisma.bookingRequest.findFirst({
      where: { listingId: id, renterId: user.id, status: "COMPLETED" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (booking) {
      const existingReview = await prisma.review.findUnique({
        where: { bookingId: booking.id },
        select: { id: true },
      });
      canReview = !existingReview;
    }
  }

  // Konaklama tarihleri URL'den. Fiyat özeti formun AYNI kurallarını kullanır
  // (validateStay): URL'yle 30 geceden uzun, geçmiş veya minimum-altı tarih
  // verilirse kitaplanamayacak toplam ASLA gösterilmez — özet ile talep formu
  // asla çelişmez (geniş inceleme düzeltmesi).
  // guests: 1 — banner misafir sayısına bağlı değil; misafir kuralı yalnız
  // talep formunda uygulanır (1 her zaman capacity'nin altındadır).
  const parsed = parseSearchParams(query);
  const stayCheck =
    parsed.baslangic && parsed.bitis
      ? validateStay(
          {
            minRentalDays: listing.minRentalDays,
            capacity: listing.capacity,
          },
          { startDate: parsed.baslangic, endDate: parsed.bitis, guests: 1 },
          listing.nightlyPrice,
        )
      : null;
  const stayNights =
    stayCheck && stayCheck.ok ? stayCheck.data.nights : null;
  const stayTotal =
    stayCheck && stayCheck.ok ? Number(stayCheck.data.totalPrice) : null;

  const location = [listing.city, listing.district].filter(Boolean).join(" · ");
  const brandModel = [listing.brand, listing.model].filter(Boolean).join(" ");
  const amenityLabels = listing.amenities
    .map((key) => AMENITIES.find((a) => a.key === key)?.label ?? key)
    .filter((label, index, all) => all.indexOf(label) === index);

  // Tasarım-kartı istatistik satırı (design2) — veri aynı, sunum ayrı.
  const stats = [
    listing.year !== null
      ? { icon: "event_available", value: String(listing.year), label: "Üretim yılı" }
      : null,
    { icon: "settings", value: TRANSMISSION_LABELS[listing.transmission], label: "Vites" },
    { icon: "local_gas_station", value: FUEL_LABELS[listing.fuel], label: "Yakıt" },
    { icon: "persons", value: `${listing.capacity} kişi`, label: "Kapasite" },
    { icon: "card_membership", value: listing.licenseRequired, label: "Ehliyet" },
    { icon: "calendar_month", value: `${listing.minRentalDays} gün`, label: "Min. kiralama" },
  ].filter((stat): stat is NonNullable<typeof stat> => stat !== null);

  const ownerInitial = (listing.owner.name || "İ").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-12">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant"
      >
        <Link href="/" className="hover:text-primary">
          Ana Sayfa
        </Link>
        <span className="material-symbols-outlined text-base text-outline">
          chevron_right
        </span>
        <Link href="/arama" className="hover:text-primary">
          Karavanlar
        </Link>
        <span className="material-symbols-outlined text-base text-outline">
          chevron_right
        </span>
        <span className="truncate text-on-surface">{listing.title}</span>
      </nav>

      {/* Başlık bloğu */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-headline-lg font-bold text-primary">
            {listing.title}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-base text-accent">
              location_on
            </span>
            {location}
          </p>
        </div>
        <span className="badge badge-primary mt-1 text-body-sm">
          {VEHICLE_TYPE_LABELS[listing.vehicleType]}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="chip">
          <span className="material-symbols-outlined text-base text-secondary">
            card_membership
          </span>
          Ehliyet: {listing.licenseRequired}
        </span>
        {listing.minDriverAge !== null ? (
          <span className="chip">
            <span className="material-symbols-outlined text-base text-secondary">
              supervisor_account
            </span>
            Min. sürücü yaşı: {listing.minDriverAge}
          </span>
        ) : null}
        <span className="chip">
          <span className="material-symbols-outlined text-base text-secondary">
            group
          </span>
          {listing.capacity} kişi
        </span>
      </div>

      {/* Galeri */}
      <div className="mt-5">
        <PhotoGallery photoUrls={listing.photoUrls} title={listing.title} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Sol: içerik */}
        <div className="space-y-6 lg:col-span-2">
          {/* İstatistik satırı */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="card flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-deep">
                  <span className="material-symbols-outlined text-xl">
                    {stat.icon}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-on-surface">
                    {stat.value}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {/* Detaylar */}
          <section className={cardClassName}>
            <SectionTitle icon="info">Detaylar</SectionTitle>
            <dl className="mt-2 divide-y divide-surface-mid">
              <Row
                label="Araç tipi"
                value={VEHICLE_TYPE_LABELS[listing.vehicleType]}
              />
              {brandModel ? <Row label="Marka / Model" value={brandModel} /> : null}
              {listing.weightKg !== null ? (
                <Row label="Ağırlık" value={`${listing.weightKg} kg`} />
              ) : null}
              {listing.lengthM !== null ? (
                <Row label="Uzunluk" value={`${listing.lengthM} m`} />
              ) : null}
            </dl>
          </section>

          <section className={cardClassName}>
            <SectionTitle icon="notes">Açıklama</SectionTitle>
            <p className="mt-3 whitespace-pre-line break-words text-body-md leading-relaxed text-on-surface-variant">
              {listing.description}
            </p>
          </section>

          <section className={cardClassName}>
            <SectionTitle icon="checklist">Olanaklar</SectionTitle>
            {amenityLabels.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">
                Bu ilan için olanak belirtilmemiş.
              </p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {amenityLabels.map((label) => (
                  <li key={label} className="chip border-accent/30 bg-accent-soft text-accent-deep">
                    <span className="material-symbols-outlined text-base">
                      check
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {listing.houseRules ? (
            <section className={cardClassName}>
              <SectionTitle icon="gavel">Ev kuralları</SectionTitle>
              <p className="mt-3 whitespace-pre-line break-words text-body-md leading-relaxed text-on-surface-variant">
                {listing.houseRules}
              </p>
            </section>
          ) : null}

          <section className={cardClassName}>
            <SectionTitle icon="star">Yorumlar</SectionTitle>
            {canReview ? (
              <Link
                href={`/ilan/${listing.id}/yorum-yaz`}
                className="btn btn-primary btn-sm mt-3"
              >
                Değerlendir
              </Link>
            ) : null}
            {reviewsData && reviewsData.reviews.length > 0 ? (
              <div className="mt-3 space-y-4">
                {reviewsData.averageRating !== null ? (
                  <div className="flex items-center gap-2">
                    <StarRating
                      value={Math.round(reviewsData.averageRating)}
                      size="sm"
                    />
                    <span className="text-body-md text-on-surface-variant">
                      {reviewsData.averageRating.toFixed(1)} / 5 (
                      {reviewsData.reviews.length} yorum)
                    </span>
                  </div>
                ) : null}
                {reviewsData.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-lg bg-surface-low p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-on-surface">
                        {review.author.name}
                      </span>
                      <StarRating value={review.rating} size="sm" />
                    </div>
                    {review.comment ? (
                      <p className="mt-2 break-words text-body-md text-on-surface-variant">
                        {review.comment}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-body-md text-on-surface-variant">
                Henüz yorum yok.
              </p>
            )}
          </section>
        </div>

        {/* Sağ: fiyat özeti + talep + sahip */}
        <aside className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-24">
            <section className={cardClassName}>
              {stayNights !== null && stayTotal !== null ? (
                <div>
                  <p className="flex items-center gap-1.5 text-body-md text-on-surface-variant">
                    <span className="material-symbols-outlined text-base text-secondary">
                      date_range
                    </span>
                    {parsed.baslangic} → {parsed.bitis}
                  </p>
                  <p className="mt-3 text-body-md text-on-surface-variant">
                    {formatTRY(nightlyPrice)} × {stayNights} gece
                  </p>
                  <p className="mt-1">
                    <span className="text-price text-primary">
                      {formatTRY(stayTotal)}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {" "}
                      toplam
                    </span>
                  </p>
                </div>
              ) : (
                <div>
                  <p>
                    <span className="text-price text-primary">
                      {formatTRY(nightlyPrice)}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {" "}
                      / gece
                    </span>
                  </p>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    {listing.minRentalDays} gün minimum kiralama
                  </p>
                </div>
              )}

              {/* Talep formu (T9): oturum yoksa giriş çağrısı, sahipse not. */}
              {user ? (
                user.id === listing.ownerId ? (
                  <div className="mt-4 rounded-lg bg-surface-low p-4 text-body-md text-on-surface-variant">
                    <p>Bu sizin ilanınız; kendi ilanınıza talep oluşturamazsınız.</p>
                  </div>
                ) : (
                  <>
                    <BookingRequestForm
                      listingId={listing.id}
                      minRentalDays={listing.minRentalDays}
                      capacity={listing.capacity}
                      nightlyPrice={nightlyPrice}
                    />
                    <AskButton listingId={listing.id} />
                    <ReportDialog targetType="LISTING" targetId={listing.id} />
                  </>
                )
              ) : (
                <div className="mt-4 rounded-lg bg-surface-low p-4 text-body-md text-on-surface-variant">
                  <p>Talep göndermek için giriş yapın.</p>
                  <Link href="/giris" className="btn btn-primary btn-sm mt-3">
                    Giriş Yap
                  </Link>
                </div>
              )}
            </section>

            {/* İlan sahibi */}
            <section className={cardClassName}>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-title-md font-bold text-white">
                  {ownerInitial}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-on-surface">
                    {listing.owner.name}
                  </p>
                  <span className="badge badge-success mt-0.5">
                    <span className="material-symbols-outlined text-sm">
                      verified
                    </span>
                    İlan sahibi
                  </span>
                </div>
              </div>
              <p className="mt-3 text-body-sm text-on-surface-variant">
                Ödeme ve teslim detayları ilan sahibiyle doğrudan
                konuşulur; platform ödeme işlemez.
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
