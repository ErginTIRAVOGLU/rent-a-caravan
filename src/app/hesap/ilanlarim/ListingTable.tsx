import Link from "next/link";
import type { Listing, ListingStatus } from "@prisma/client";

import { formatTRY } from "../../../lib/format";
import { ListingActions } from "./ListingActions";

/** Durum rozetleri — arayüz metni Türkçe, DB değeri İngilizce. */
export const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "İncelemede",
  ACTIVE: "Yayında",
  REJECTED: "Reddedildi",
  PAUSED: "Askıda",
};

export const STATUS_BADGES: Record<ListingStatus, string> = {
  DRAFT: "badge badge-neutral",
  PENDING: "badge badge-warning",
  ACTIVE: "badge badge-success",
  REJECTED: "badge badge-error",
  PAUSED: "badge badge-info",
};

/** Reddedilen ilanın gerekçesi — yalnız REJECTED + gerekçe varsa görünür. */
function RejectionNote({ listing }: { listing: Listing }) {
  if (listing.status !== "REJECTED" || !listing.rejectionReason) {
    return null;
  }
  return (
    <p className="mt-1 break-words text-body-sm text-error">
      Red gerekçesi: {listing.rejectionReason}
    </p>
  );
}

/**
 * İlan listesi — masaüstünde gerçek `<table>`, mobilde aynı veriyi taşıyan
 * kartlar. İki sunum da DOM'da bulunur; görünürlük CSS ile (`md:` kırılımı)
 * yönetilir. Tek veri kaynağı: `listings` prop'u.
 */
export function ListingTable({ listings }: { listings: Listing[] }) {
  return (
    <>
      {/* Masaüstü tablo sunumu. */}
      <div
        data-testid="listings-table"
        className="hidden overflow-x-auto md:block"
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/60 text-label-md uppercase tracking-wider text-on-surface-variant">
              <th scope="col" className="px-3 py-3 font-medium">
                Başlık
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Şehir
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Fiyat/Gece
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Kapasite
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Durum
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Aksiyonlar
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Geçmiş
              </th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr
                key={listing.id}
                className="border-b border-outline-variant/40 align-top last:border-0"
              >
                <td className="px-3 py-4">
                  <span className="font-semibold text-on-surface">
                    {listing.title}
                  </span>
                  <RejectionNote listing={listing} />
                </td>
                <td className="px-3 py-4 text-on-surface-variant">
                  {listing.city}
                </td>
                <td className="px-3 py-4 text-on-surface">
                  {formatTRY(Number(listing.nightlyPrice))}
                </td>
                <td className="px-3 py-4 text-on-surface-variant">
                  {listing.capacity} kişi
                </td>
                <td className="px-3 py-4">
                  <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <ListingActions
                    listingId={listing.id}
                    status={listing.status}
                  />
                </td>
                <td className="px-3 py-4">
                  <Link
                    href={`/hesap/ilanlarim/${listing.id}/gecmis`}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Geçmiş
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kart sunumu — aynı veri. */}
      <ul data-testid="listings-cards" className="space-y-4 md:hidden">
        {listings.map((listing) => (
          <li
            key={listing.id}
            className="rounded-xl border border-outline-variant/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-bold text-on-surface">
                  {listing.title}
                </h2>
                <div className="mt-1 flex flex-wrap gap-x-3 text-body-md text-on-surface-variant">
                  <span>{listing.city}</span>
                  <span>{formatTRY(Number(listing.nightlyPrice))}/gece</span>
                  <span>{listing.capacity} kişi</span>
                </div>
              </div>
              <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                {STATUS_LABELS[listing.status]}
              </span>
            </div>

            <RejectionNote listing={listing} />

            <div className="mt-4">
              <ListingActions listingId={listing.id} status={listing.status} />
            </div>
            <div className="mt-2">
              <Link
                href={`/hesap/ilanlarim/${listing.id}/gecmis`}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                Geçmiş
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
