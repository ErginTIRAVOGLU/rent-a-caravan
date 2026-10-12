import Link from "next/link";
import type { ListingStatus, Prisma } from "@prisma/client";

import { formatTRY } from "../../../lib/format";
import { AdminListingActions } from "./AdminListingActions";
import { STATUS_BADGES, STATUS_LABELS } from "./listing-status";

/** Admin ilan kuyruğu satırı — sahibiyle birlikte. */
export type AdminListingRow = {
  id: string;
  title: string;
  city: string;
  nightlyPrice: Prisma.Decimal;
  capacity: number;
  status: ListingStatus;
  rejectionReason: string | null;
  owner: { name: string; email: string };
};

/** Reddedilen ilanın gerekçesi — yalnız REJECTED + gerekçe varsa görünür. */
function RejectionNote({ listing }: { listing: AdminListingRow }) {
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
 * Admin ilan listesi — masaüstünde gerçek `<table>`, mobilde aynı veriyi taşıyan
 * kartlar. İki sunum da DOM'da bulunur; görünürlük CSS ile (`md:` kırılımı)
 * yönetilir. Tek veri kaynağı: `listings` prop'u. Satır aksiyonları mevcut
 * istemci adası `AdminListingActions`'tır.
 */
export function AdminListingsTable({
  listings,
}: {
  listings: AdminListingRow[];
}) {
  return (
    <>
      {/* Masaüstü tablo sunumu. */}
      <div
        data-testid="admin-listings-table"
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
                Sahip
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Durum
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Aksiyonlar
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
                  <Link
                    href={`/admin/ilanlar/${listing.id}`}
                    className="font-semibold text-on-surface hover:text-primary hover:underline"
                  >
                    {listing.title}
                  </Link>
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
                <td className="px-3 py-4 text-on-surface-variant">
                  <span className="block text-on-surface">
                    {listing.owner.name}
                  </span>
                  <span className="block text-body-sm">
                    {listing.owner.email}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                    {STATUS_LABELS[listing.status]}
                  </span>
                </td>
                <td className="px-3 py-4">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kart sunumu — aynı veri. */}
      <ul data-testid="admin-listings-cards" className="space-y-4 md:hidden">
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

            <p className="mt-2 text-body-md text-on-surface-variant">
              {listing.owner.name} ({listing.owner.email})
            </p>

            <RejectionNote listing={listing} />

            <div className="mt-4">
              <Link
                href={`/admin/ilanlar/${listing.id}`}
                className="btn btn-outline py-2"
              >
                İncele
              </Link>
            </div>
            <AdminListingActions
              listingId={listing.id}
              status={listing.status}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
