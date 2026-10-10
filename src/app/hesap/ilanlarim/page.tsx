import type { Metadata } from "next";
import Link from "next/link";
import type { ListingStatus } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { ListingActions } from "./ListingActions";

export const metadata: Metadata = {
  title: "İlanlarım — Karavan Kiralama",
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
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING: "bg-amber-100 text-amber-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  PAUSED: "bg-slate-200 text-slate-700",
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
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">İlanlarım</h1>
            <p className="mt-1 text-sm text-gray-600">
              Karavan ilanlarınızı oluşturun ve durumlarını takip edin.
            </p>
          </div>
          <Link
            href="/hesap/ilanlarim/yeni"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Yeni İlan
          </Link>
        </header>

        {listings.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">Henüz hiç ilanınız yok.</p>
            <Link
              href="/hesap/ilanlarim/yeni"
              className="mt-3 inline-block font-semibold text-emerald-600 hover:underline"
            >
              İlk ilanınızı oluşturun →
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-gray-900">
                      {listing.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {listing.city} · {Number(listing.nightlyPrice)} ₺/gece ·{" "}
                      {listing.capacity} kişi
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[listing.status]}`}
                  >
                    {STATUS_LABELS[listing.status]}
                  </span>
                </div>

                {listing.status === "REJECTED" && listing.rejectionReason ? (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    Red gerekçesi: {listing.rejectionReason}
                  </p>
                ) : null}

                <div className="mt-4">
                  <ListingActions
                    listingId={listing.id}
                    status={listing.status}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
