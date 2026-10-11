import type { Metadata } from "next";
import Link from "next/link";
import type { ListingStatus } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { formatTRY } from "../../../lib/format";
import { prisma } from "../../../lib/prisma";
import { AccountNav } from "../../../components/AccountNav";
import { ListingActions } from "./ListingActions";

export const metadata: Metadata = {
  title: "İlanlarım",
};

/** Durum rozetleri — arayüz metni Türkçe, DB değeri İngilizce. */
const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "İncelemede",
  ACTIVE: "Yayında",
  REJECTED: "Reddedildi",
  PAUSED: "Askıda",
};

const STATUS_BADGES: Record<ListingStatus, string> = {
  DRAFT: "badge badge-neutral",
  PENDING: "badge badge-warning",
  ACTIVE: "badge badge-success",
  REJECTED: "badge badge-error",
  PAUSED: "badge badge-info",
};

/**
 * Kullanıcının kendi ilanları. Sahip-sadece: sorgu zaten `ownerId = user.id`
 * filtreli; mutationlar `ListingActions` üzerinden service yetkisini uygular.
 */
export default async function IlanlarimPage() {
  const user = await requireUser();
  const listings = await prisma.listing.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <span className="eyebrow">Hesabım</span>
          <h1 className="mt-1 text-headline-lg font-bold text-primary">İlanlarım</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Karavan ilanlarınızı oluşturun ve durumlarını takip edin.
          </p>
        </div>
        <Link href="/hesap/ilanlarim/yeni" className="btn btn-primary">
          <span className="material-symbols-outlined text-lg">add</span>
          Yeni İlan
        </Link>
      </header>

      <AccountNav current="ilanlarim" />

      {listings.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-outline">
            rv_hookup
          </span>
          <p className="mt-2 font-semibold text-on-surface">Henüz hiç ilanınız yok</p>
          <Link href="/hesap/ilanlarim/yeni" className="btn btn-primary btn-sm mt-4">
            İlk ilanınızı oluşturun
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {listings.map((listing) => (
            <li key={listing.id} className="card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-on-surface">{listing.title}</h2>
                  <p className="mt-1 text-body-md text-on-surface-variant">
                    {listing.city} · {formatTRY(Number(listing.nightlyPrice))}
                    /gece · {listing.capacity} kişi
                  </p>
                </div>
                <span className={`shrink-0 ${STATUS_BADGES[listing.status]}`}>
                  {STATUS_LABELS[listing.status]}
                </span>
              </div>

              {listing.status === "REJECTED" && listing.rejectionReason ? (
                <p className="mt-3 break-words rounded-lg bg-error-bg p-3 text-body-md text-error">
                  Red gerekçesi: {listing.rejectionReason}
                </p>
              ) : null}

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
      )}
    </div>
  );
}
