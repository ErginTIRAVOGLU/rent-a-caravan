import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PhotoGallery } from "../../../../components/PhotoGallery";
import { AMENITIES } from "../../../../lib/amenities";
import { requireAdmin } from "../../../../lib/auth";
import { formatTRY } from "../../../../lib/format";
import {
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_TYPE_LABELS,
} from "../../../../lib/labels";
import { prisma } from "../../../../lib/prisma";
import { AdminListingActions } from "../AdminListingActions";
import { STATUS_BADGES, STATUS_LABELS } from "../listing-status";
import {
  actorLabelFor,
  ListingHistoryList,
} from "../../../../components/ListingHistoryList";

export const metadata: Metadata = {
  title: "İlan İnceleme",
};

type Props = {
  params: Promise<{ id: string }>;
};

/** Özet satırı (ilan detay sayfasıyla aynı kalıp). */
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

/**
 * İlan önizleme: kuyruktan içeriği görme. `requireAdmin()` kapısı (admin
 * layout zaten korur, burada da açık kapı); olmayan id → `notFound()`.
 * Her durumdaki ilan görünür (PENDING herkese açık yüzeyde 404'tür ama
 * burada incelenir). Karar, aynı sayfadaki `AdminListingActions` ile
 * doğrudan verilir.
 */
export default async function AdminListingDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!listing) {
    notFound();
  }
  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
    orderBy: { createdAt: "asc" },
  });

  const location = [listing.city, listing.district].filter(Boolean).join(" · ");
  const brandModel = [listing.brand, listing.model].filter(Boolean).join(" ");
  const amenityLabels = listing.amenities
    .map((key) => AMENITIES.find((a) => a.key === key)?.label ?? key)
    .filter((label, index, all) => all.indexOf(label) === index);
  const createdAt = listing.createdAt.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        href="/admin/ilanlar"
        className="inline-flex items-center gap-1 text-body-md text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        İlanlara dön
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-headline-lg font-bold text-primary">
            {listing.title}
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">{location}</p>
        </div>
        <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
          {STATUS_LABELS[listing.status]}
        </span>
      </header>

      <div className="mt-5">
        <PhotoGallery photoUrls={listing.photoUrls} title={listing.title} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5 sm:p-6">
            <h2 className="section-title">Özet</h2>
            <dl className="mt-2 divide-y divide-surface-mid">
              <Row
                label="Gecelik fiyat"
                value={`${formatTRY(Number(listing.nightlyPrice))} / gece`}
              />
              <Row label="Kapasite" value={`${listing.capacity} kişi`} />
              <Row
                label="Araç tipi"
                value={VEHICLE_TYPE_LABELS[listing.vehicleType]}
              />
              {brandModel ? (
                <Row label="Marka / Model" value={brandModel} />
              ) : null}
              {listing.year !== null ? (
                <Row label="Üretim yılı" value={String(listing.year)} />
              ) : null}
              <Row
                label="Vites"
                value={TRANSMISSION_LABELS[listing.transmission]}
              />
              <Row label="Yakıt" value={FUEL_LABELS[listing.fuel]} />
              <Row label="Gerekli ehliyet" value={listing.licenseRequired} />
              {listing.minDriverAge !== null ? (
                <Row
                  label="Min. sürücü yaşı"
                  value={String(listing.minDriverAge)}
                />
              ) : null}
              <Row
                label="Min. kiralama süresi"
                value={`${listing.minRentalDays} gün`}
              />
              {listing.weightKg !== null ? (
                <Row label="Ağırlık" value={`${listing.weightKg} kg`} />
              ) : null}
              {listing.lengthM !== null ? (
                <Row label="Uzunluk" value={`${listing.lengthM} m`} />
              ) : null}
            </dl>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="section-title">Açıklama</h2>
            <p className="mt-3 whitespace-pre-line break-words text-body-md leading-relaxed text-on-surface-variant">
              {listing.description}
            </p>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="section-title">Olanaklar</h2>
            {amenityLabels.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">
                Bu ilan için olanak belirtilmemiş.
              </p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {amenityLabels.map((label) => (
                  <li key={label} className="chip">
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {listing.houseRules ? (
            <section className="card p-5 sm:p-6">
              <h2 className="section-title">Ev kuralları</h2>
              <p className="mt-3 whitespace-pre-line break-words text-body-md leading-relaxed text-on-surface-variant">
                {listing.houseRules}
              </p>
            </section>
          ) : null}

          {listing.status === "REJECTED" && listing.rejectionReason ? (
            <section className="card p-5 sm:p-6">
              <h2 className="section-title">Red gerekçesi</h2>
              <p className="mt-3 break-words rounded-lg bg-error-bg p-3 text-body-md text-error">
                {listing.rejectionReason}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-24">
            <section className="card p-5 sm:p-6">
              <h2 className="section-title">İlan sahibi</h2>
              <p className="mt-3 truncate font-bold text-on-surface">
                {listing.owner.name}
              </p>
              <p className="mt-1 break-all text-body-md text-on-surface-variant">
                {listing.owner.email}
              </p>
              <p className="mt-3 text-body-md text-on-surface-variant">
                Oluşturma: {createdAt}
              </p>
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="section-title">Moderasyon</h2>
              <AdminListingActions
                listingId={listing.id}
                status={listing.status}
              />
            </section>

            <section className="card p-5 sm:p-6">
              <h2 className="section-title">Durum geçmişi</h2>
              <div className="mt-2">
                <ListingHistoryList
                  entries={history.map((entry) => ({
                    id: entry.id,
                    fromStatus: entry.fromStatus,
                    toStatus: entry.toStatus,
                    actorLabel: actorLabelFor(entry.actorId, listing.ownerId),
                    reason: entry.reason,
                    createdAt: entry.createdAt,
                  }))}
                />
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
