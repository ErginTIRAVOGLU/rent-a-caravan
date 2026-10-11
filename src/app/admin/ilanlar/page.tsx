import type { Metadata } from "next";
import Link from "next/link";

import { formatTRY } from "../../../lib/format";
import { prisma } from "../../../lib/prisma";
import { AdminListingActions } from "./AdminListingActions";
import { STATUS_BADGES, STATUS_LABELS } from "./listing-status";

export const metadata: Metadata = {
  title: "İlanlar",
};

// Durum rozetleri `listing-status.ts` paylaşım modülündedir (kuyruk + detay
// önizleme aynı haritaları kullanır).

/**
 * İlan moderasyonu: İNCELEME KUYRUĞU (PENDING — onayla/reddet), YAYINDAKİLER
 * (ACTIVE — duraklat), DURAKLATILMIŞLAR (PAUSED — yayına al) ve RED GEÇMİŞİ
 * (REJECTED — gerekçeyle, salt okunur). Durum geçişleri yalnızca service
 * matrisinde (PENDING→ACTIVE|REJECTED, ACTIVE→PAUSED, PAUSED→ACTIVE)
 * yapılır; diğer durumlar için burada düğme sunulmaz.
 */
export default async function AdminListingsPage() {
  const [pending, active, paused, rejected] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "PENDING" },
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" }, // en eski başvuru önce
    }),
    prisma.listing.findMany({
      where: { status: "ACTIVE" },
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.listing.findMany({
      where: { status: "PAUSED" },
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.listing.findMany({
      where: { status: "REJECTED" },
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="mb-6">
        <span className="eyebrow">Yönetim</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">İlanlar</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Bekleyen ilanları inceleyin, onaylayın veya gerekçeyle reddedin.
        </p>
      </header>

      {/* İnceleme kuyruğu */}
      <section className="mt-8">
        <h2 className="section-title">İncelemedeki ilanlar ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">inbox</span>
            <p className="mt-2 font-semibold text-on-surface">İnceleme sırasındaki ilan yok</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {pending.map((listing) => (
              <li key={listing.id} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">
                      <Link
                        href={`/admin/ilanlar/${listing.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      {listing.city} · {formatTRY(Number(listing.nightlyPrice))}
                      /gece · {listing.capacity} kişi · {listing.owner.name} (
                      {listing.owner.email})
                    </p>
                  </div>
                  <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <Link
                    href={`/admin/ilanlar/${listing.id}`}
                    className="btn btn-outline py-2"
                  >
                    İncele
                  </Link>
                  <AdminListingActions
                    listingId={listing.id}
                    status={listing.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Yayındaki ilanlar — duraklatma adayları */}
      <section className="mt-10">
        <h2 className="section-title">Yayındaki ilanlar ({active.length})</h2>
        {active.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">check_circle</span>
            <p className="mt-2 font-semibold text-on-surface">Yayında ilan yok</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {active.map((listing) => (
              <li key={listing.id} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">
                      <Link
                        href={`/admin/ilanlar/${listing.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      {listing.city} · {formatTRY(Number(listing.nightlyPrice))}
                      /gece · {listing.owner.name}
                    </p>
                  </div>
                  <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <Link
                    href={`/admin/ilanlar/${listing.id}`}
                    className="btn btn-outline py-2"
                  >
                    İncele
                  </Link>
                  <AdminListingActions
                    listingId={listing.id}
                    status={listing.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Duraklatılmış ilanlar — yayına alma adayları */}
      <section className="mt-10">
        <h2 className="section-title">Duraklatılmış ilanlar ({paused.length})</h2>
        {paused.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">pause_circle</span>
            <p className="mt-2 font-semibold text-on-surface">Duraklatılmış ilan yok</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {paused.map((listing) => (
              <li key={listing.id} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">
                      <Link
                        href={`/admin/ilanlar/${listing.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      {listing.city} · {formatTRY(Number(listing.nightlyPrice))}
                      /gece · {listing.owner.name}
                    </p>
                  </div>
                  <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <Link
                    href={`/admin/ilanlar/${listing.id}`}
                    className="btn btn-outline py-2"
                  >
                    İncele
                  </Link>
                  <AdminListingActions
                    listingId={listing.id}
                    status={listing.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Red geçmişi — salt okunur */}
      <section className="mt-10">
        <h2 className="section-title">Reddedilen ilanlar ({rejected.length})</h2>
        {rejected.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">block</span>
            <p className="mt-2 font-semibold text-on-surface">Red geçmişi boş</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {rejected.map((listing) => (
              <li key={listing.id} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">
                      <Link
                        href={`/admin/ilanlar/${listing.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      {listing.city} · {listing.owner.name} (
                      {listing.owner.email})
                    </p>
                  </div>
                  <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                {listing.rejectionReason ? (
                  <p className="mt-3 break-words rounded-lg bg-error-bg p-3 text-body-md text-error">
                    Red gerekçesi: {listing.rejectionReason}
                  </p>
                ) : null}
                <div className="mt-4">
                  <Link
                    href={`/admin/ilanlar/${listing.id}`}
                    className="btn btn-outline py-2"
                  >
                    İncele
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
