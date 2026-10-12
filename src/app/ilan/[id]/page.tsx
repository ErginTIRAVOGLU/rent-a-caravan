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
    include: { 
      owner: { select: { name: true, email: true, avatarUrl: true } },
    },
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

  // İstatistik kartları
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

  // --- YARDIMCI BİLEŞENLER (JSX içinde inline tanımlı) ---

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-12">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-body-sm text-on-surface-variant"
      >
        <Link href="/" className="hover:text-primary">Ana Sayfa</Link>
        <span className="material-symbols-outlined text-base text-outline">chevron_right</span>
        <Link href="/arama" className="hover:text-primary">Karavanlar</Link>
        <span className="material-symbols-outlined text-base text-outline">chevron_right</span>
        <span className="truncate text-on-surface">{listing.title}</span>
      </nav>

      {/* Header: Başlık, konum, rozetler, fiyat, puan, favori, paylaş */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-headline-lg font-bold text-primary">{listing.title}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-base text-accent">location_on</span>
            {location}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge badge-primary mt-1 text-body-sm">
            {VEHICLE_TYPE_LABELS[listing.vehicleType]}
          </span>
        </div>
      </div>

      {/* Hızlı bilgi çubuğu — gerçek ilan verisi (stats) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {stats.map((stat) => (
          <span
            key={stat.label}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-low px-3 py-2 text-body-md text-on-surface"
          >
            <span className="material-symbols-outlined text-lg text-accent">{stat.icon}</span>
            <span>{stat.value}</span>
          </span>
        ))}
        {listing.minDriverAge !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-low px-3 py-2 text-body-md text-on-surface">
            <span className="material-symbols-outlined text-lg text-accent">supervisor_account</span>
            <span>Min. sürücü yaşı {listing.minDriverAge}</span>
          </span>
        )}
      </div>

      {/* Ana içerik: Sol taraf (galeri + içerik) + Sağ taraf (rezervasyon paneli) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* SOL TARAF: Galeri + İçerik */}
        <div className="space-y-6 lg:col-span-8">
          {/* BÜYÜK GALERİ + KÜÇÜK RESİMLER */}
          <div className="space-y-3">
            {/* Ana görsel */}
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-surface-low">
              {listing.photoUrls.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element -- UploadThing URL'leri next.config images domain listesinde değil; bkz. ListingCard
                <img
                  src={listing.photoUrls[0]}
                  alt={`${listing.title} - Ana görsel`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-mid">
                  <span className="material-symbols-outlined text-4xl text-outline">photo_camera</span>
                </div>
              )}
            </div>

            {/* Küçük resimler (thumbnail strip) */}
            {listing.photoUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                {listing.photoUrls.map((url, index) => (
                  <button
                    key={index}
                    className="relative h-20 w-28 shrink-0 rounded-lg overflow-hidden border-2 border-transparent hover:border-accent transition-colors"
                    aria-label={`Fotoğraf ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- bkz. yukarıdaki galeri yorumu */}
                    <img
                      src={url}
                      alt={`${listing.title} - Fotoğraf ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SAĞ TARAF: YAPIŞKAN REZERVASYON PANELİ */}
        <aside className="lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-24">
              {/* FİYAT ÖZETİ + REZERVASYON BUTONU */}
              <section className="card p-5">
                <div className="mb-4">
                  {stayNights !== null && stayTotal !== null ? (
                    <div>
                      <p className="flex items-center gap-1.5 text-body-md text-on-surface-variant">
                        <span className="material-symbols-outlined text-base text-secondary">date_range</span>
                        {parsed.baslangic} → {parsed.bitis}
                      </p>
                      <p className="mt-3 text-body-md text-on-surface-variant">
                        {formatTRY(nightlyPrice)} × {stayNights} gece
                      </p>
                      <p className="mt-1">
                        <span className="text-price text-primary">{formatTRY(stayTotal)}</span>
                        <span className="text-body-sm text-on-surface-variant">{" "}toplam</span>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p>
                        <span className="text-price text-primary">{formatTRY(nightlyPrice)}</span>
                        <span className="text-body-sm text-on-surface-variant">{" "}/ gece</span>
                      </p>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        {listing.minRentalDays} gün minimum kiralama
                      </p>
                    </div>
                  )}
                </div>

                {/* Talep formu: oturum yoksa giriş çağrısı, sahipse not. */}
                {user ? (
                  user.id === listing.ownerId ? (
                    <div className="rounded-lg bg-surface-low p-4 text-body-md text-on-surface-variant">
                      Bu sizin ilanınız; kendi ilanınıza talep oluşturamazsınız.
                    </div>
                  ) : (
                    <div>
                      {/* Form KOŞULSUZ render olur: tarih seçimi formun içindedir
                          ve URL'de tarih olmadan da (city-only arama) talep
                          gönderilebilmelidir — fiyat ÖZETİ kapalı kalır, form
                          kapalı kalmaz (e2e senaryo 1/2 bu akışı doğrular). */}
                      <BookingRequestForm
                        listingId={listing.id}
                        minRentalDays={listing.minRentalDays}
                        capacity={listing.capacity}
                        nightlyPrice={nightlyPrice}
                      />
                      <div className="mt-3 flex flex-col gap-2">
                        <AskButton listingId={listing.id} />
                        <ReportDialog targetType="LISTING" targetId={listing.id} />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-lg bg-surface-low p-4 text-body-md text-on-surface-variant">
                    <p>Talep göndermek için giriş yapın.</p>
                    <Link href="/giris" className="btn btn-primary btn-sm mt-3">
                      Giriş Yap
                    </Link>
                  </div>
                )}

                {stayTotal !== null && (
                  <p className="mt-3 text-body-sm text-on-surface-variant">
                    Toplam: <strong className="text-primary">{formatTRY(stayTotal)}</strong> (tüm vergiler dahil)
                  </p>
                )}

                {/* Ön ödeme yok / güven mesajı */}
                <p className="mt-3 text-center text-body-sm text-success">
                  <span className="material-symbols-outlined text-base align-middle">verified_user</span>
                  Ön ödeme yok, güvenle rezervasyon yapın
                </p>
              </section>

              {/* İlan sahibi kartı */}
              <section className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-title-md font-bold text-white">
                    {ownerInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-on-surface">{listing.owner.name}</p>
                    <span className="badge badge-success mt-0.5">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      İlan sahibi
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-body-sm text-on-surface-variant">
                  Ödeme ve teslim detayları ilan sahibiyle doğrudan konuşulur; platform ödeme işlemez.
                </p>
              </section>

              {/* Sahip iletişim butonu (giriş yapılmışsa) */}
              {user && user.id !== listing.ownerId && (
                <button className="btn btn-outline w-full">
                  <span className="material-symbols-outlined text-base">chat</span>
                  Sahiple iletişime geç
                </button>
              )}
            </div>
          </aside>
        </div> {/* lg:grid-cols-12 container end */}

        {/* TAM GENİŞLİK İÇERİK BÖLÜMLERİ (lg:col-span-12) */}
        <div className="mt-10 lg:col-span-12 space-y-6">
          {/* HAZİRLIK / HAKKINDA */}
          <section className={cardClassName}>
            <SectionTitle icon="info">Hakkında</SectionTitle>
            <p className="mt-3 whitespace-pre-line break-words text-body-md leading-relaxed text-on-surface-variant">
              {listing.description}
            </p>
          </section>

          {/* ARAÇ BİLGİLERİ — şemadaki gerçek alanlar */}
          {(listing.brand || listing.model || listing.year !== null || listing.weightKg !== null || listing.lengthM !== null) && (
            <section className={cardClassName}>
              <SectionTitle icon="directions_car">Araç Bilgileri</SectionTitle>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {brandModel && (
                  <div className="rounded-lg bg-surface-low p-3">
                    <dt className="text-body-sm text-on-surface-variant">Marka / Model</dt>
                    <dd className="text-body-md font-semibold text-on-surface">{brandModel}</dd>
                  </div>
                )}
                {listing.year !== null && (
                  <div className="rounded-lg bg-surface-low p-3">
                    <dt className="text-body-sm text-on-surface-variant">Üretim yılı</dt>
                    <dd className="text-body-md font-semibold text-on-surface">{listing.year}</dd>
                  </div>
                )}
                <div className="rounded-lg bg-surface-low p-3">
                  <dt className="text-body-sm text-on-surface-variant">Vites</dt>
                  <dd className="text-body-md font-semibold text-on-surface">{TRANSMISSION_LABELS[listing.transmission]}</dd>
                </div>
                <div className="rounded-lg bg-surface-low p-3">
                  <dt className="text-body-sm text-on-surface-variant">Yakıt</dt>
                  <dd className="text-body-md font-semibold text-on-surface">{FUEL_LABELS[listing.fuel]}</dd>
                </div>
                {listing.weightKg !== null && (
                  <div className="rounded-lg bg-surface-low p-3">
                    <dt className="text-body-sm text-on-surface-variant">Ağırlık</dt>
                    <dd className="text-body-md font-semibold text-on-surface">{listing.weightKg} kg</dd>
                  </div>
                )}
                {listing.lengthM !== null && (
                  <div className="rounded-lg bg-surface-low p-3">
                    <dt className="text-body-sm text-on-surface-variant">Uzunluk</dt>
                    <dd className="text-body-md font-semibold text-on-surface">{listing.lengthM} m</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {/* OLANAKLAR */}
          <section className={cardClassName}>
            <SectionTitle icon="checklist">Olanaklar</SectionTitle>
            {amenityLabels.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">Bu ilan için olanak belirtilmemiş.</p>
            ) : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {amenityLabels.map((label) => (
                  <li key={label} className="flex items-center gap-2 rounded-lg bg-surface-low px-3 py-2 text-body-md text-on-surface">
                    <span className="material-symbols-outlined text-accent">check_circle</span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* EV KURALLARI */}
          {listing.houseRules ? (
            <section className={cardClassName}>
              <SectionTitle icon="gavel">Ev Kuralları</SectionTitle>
              <p className="mt-3 whitespace-pre-line break-words text-body-md leading-relaxed text-on-surface-variant">
                {listing.houseRules}
              </p>
            </section>
          ) : null}

          {/* YORUMLAR */}
          <section className={cardClassName}>
            <SectionTitle icon="star">Değerlendirmeler</SectionTitle>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {canReview ? (
                  <Link href={`/ilan/${listing.id}/yorum-yaz`} className="btn btn-primary btn-sm">
                    Değerlendir
                  </Link>
                ) : null}
              </div>
            </div>

            {reviewsData && reviewsData.reviews.length > 0 ? (
              <>
                {reviewsData.averageRating !== null && (
                  <div className="flex items-center gap-3 mb-4">
                    <StarRating value={Math.round(reviewsData.averageRating)} size="lg" />
                    <div>
                      <p className="text-headline-sm font-bold text-primary">{reviewsData.averageRating.toFixed(1)} / 5</p>
                      <p className="text-body-md text-on-surface-variant">{reviewsData.reviews.length} yorum</p>
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-4">
                  {reviewsData.reviews.map((review) => (
                    <div key={review.id} className="rounded-lg bg-surface-low p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold">
                            {(review.author.name || "İ").slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold text-on-surface">{review.author.name}</p>
                            <p className="text-body-sm text-on-surface-variant">
                              {new Date(review.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <StarRating value={review.rating} size="md" />
                      </div>
                      {review.comment && (
                        <p className="mt-3 break-words text-body-md text-on-surface-variant">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-body-md text-on-surface-variant text-center py-8">
                Henüz yorum yok. İlk yorumu siz yazın!
              </p>
            )}
          </section>
        </div>

        {/* ADMIN ÖNİZLEME SAYFASI - History bölümü */}
        {/* (Zaten Task 22'de eklendi, burada tekrar etmeye gerek yok) */}
      </div>
  );
}