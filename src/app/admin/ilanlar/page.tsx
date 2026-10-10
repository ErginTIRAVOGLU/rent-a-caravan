import type { Metadata } from "next";
import type { ListingStatus } from "@prisma/client";

import { formatTRY } from "../../../lib/format";
import { prisma } from "../../../lib/prisma";
import { AdminListingActions } from "./AdminListingActions";

export const metadata: Metadata = {
  title: "İlan Moderasyonu — Yönetim",
};

// Durum rozetleri — arayüz metni Türkçe, DB değeri İngilizce
// (hesap/ilanlarim sayfası ile aynı kalıp).
const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "İncelemede",
  ACTIVE: "Yayında",
  REJECTED: "Reddedildi",
  PAUSED: "Askıda",
};

const STATUS_BADGES: Record<ListingStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  PAUSED: "bg-slate-200 text-slate-700",
};

/**
 * İlan moderasyonu: İNCELEME KUYRUĞU (PENDING — onayla/reddet), YAYINDAKİLER
 * (ACTIVE — duraklat) ve RED GEÇMİŞİ (REJECTED — gerekçeyle, salt okunur).
 * Durum geçişleri yalnızca service matrisinde (PENDING→ACTIVE|REJECTED,
 * ACTIVE→PAUSED) yapılır; diğer durumlar için burada düğme sunulmaz.
 */
export default async function AdminListingsPage() {
  const [pending, active, rejected] = await Promise.all([
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
      where: { status: "REJECTED" },
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">İlanlar</h1>
      <p className="mt-1 text-sm text-gray-600">
        Bekleyen ilanları inceleyin, onaylayın veya gerekçeyle reddedin.
      </p>

      {/* İnceleme kuyruğu */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">
          İncelemedeki ilanlar ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-gray-600">İnceleme sırasındaki ilan yok.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {pending.map((listing) => (
              <li key={listing.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {listing.city} · {formatTRY(Number(listing.nightlyPrice))}
                      /gece · {listing.capacity} kişi · {listing.owner.name} (
                      {listing.owner.email})
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[listing.status]}`}
                  >
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                <div className="mt-4">
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
        <h2 className="text-lg font-bold text-gray-900">
          Yayındaki ilanlar ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-gray-600">Yayında ilan yok.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {active.map((listing) => (
              <li key={listing.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {listing.city} · {formatTRY(Number(listing.nightlyPrice))}
                      /gece · {listing.owner.name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[listing.status]}`}
                  >
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                <div className="mt-4">
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
        <h2 className="text-lg font-bold text-gray-900">
          Reddedilen ilanlar ({rejected.length})
        </h2>
        {rejected.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-gray-600">Red geçmişi boş.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {rejected.map((listing) => (
              <li key={listing.id} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900">
                      {listing.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {listing.city} · {listing.owner.name} (
                      {listing.owner.email})
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[listing.status]}`}
                  >
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>
                {listing.rejectionReason ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    Red gerekçesi: {listing.rejectionReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
