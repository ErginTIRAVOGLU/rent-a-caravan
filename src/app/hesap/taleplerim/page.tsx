import type { Metadata } from "next";
import Link from "next/link";
import type { BookingRequestStatus } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { formatTRY } from "../../../lib/format";
import { prisma } from "../../../lib/prisma";
import { BookingActions } from "./BookingActions";

export const metadata: Metadata = {
  title: "Taleplerim — Karavan Kiralama",
};

// Rezervasyon talepleri: GELEN (kullanıcı ilan sahibi) ve GİDEN (kiracı).
// Durum rozetleri TR; DB değeri İngilizce (ilanlarim sayfası ile aynı kalıp).

const STATUS_LABELS: Record<BookingRequestStatus, string> = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal",
  COMPLETED: "Tamamlandı",
};

const STATUS_BADGES: Record<BookingRequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-700",
  COMPLETED: "bg-blue-100 text-blue-800",
};

/** @db.Date → DD.MM.YYYY (UTC gece yarısı; saat dilimi kaymaz). */
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

function DateRange({ start, end }: { start: Date; end: Date }) {
  return (
    <span>
      {formatDate(start)} – {formatDate(end)}
    </span>
  );
}

export default async function TaleplerimPage() {
  const user = await requireUser();

  const [incoming, outgoing] = await Promise.all([
    // Gelen: kullanıcı ilanlarının sahibi olduğu talepler
    prisma.bookingRequest.findMany({
      where: { listing: { ownerId: user.id } },
      include: {
        listing: { select: { id: true, title: true } },
        renter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Giden: kullanıcının kiracı olduğu talepler
    prisma.bookingRequest.findMany({
      where: { renterId: user.id },
      include: {
        listing: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Taleplerim</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gelen talepleri onaylayın ya da reddedin, kendi taleplerinizi takip
            edin.
          </p>
        </header>

        {/* GELEN */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Gelen Talepler</h2>
          {incoming.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
              Henüz gelen talep yok.
            </div>
          ) : (
            <ul className="mt-3 space-y-4">
              {incoming.map((booking) => (
                <li
                  key={booking.id}
                  className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">
                        {booking.listing.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        <DateRange
                          start={booking.startDate}
                          end={booking.endDate}
                        />{" "}
                        · {booking.guests} kişi ·{" "}
                        {formatTRY(Number(booking.totalPrice))}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        Kiracı: {booking.renter.name}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>

                  {booking.message ? (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      “{booking.message}”
                    </p>
                  ) : null}

                  {booking.status === "PENDING" ? (
                    <BookingActions bookingId={booking.id} mode="decide" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* GİDEN */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">Giden Taleplerim</h2>
          {outgoing.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
              Henüz talebiniz yok.{" "}
              <Link
                href="/arama"
                className="font-semibold text-emerald-700 hover:underline"
              >
                Karavan arayın →
              </Link>
            </div>
          ) : (
            <ul className="mt-3 space-y-4">
              {outgoing.map((booking) => (
                <li
                  key={booking.id}
                  className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">
                        {booking.listing.status === "ACTIVE" ? (
                          <Link
                            href={`/ilan/${booking.listing.id}`}
                            className="hover:text-emerald-700 hover:underline"
                          >
                            {booking.listing.title}
                          </Link>
                        ) : (
                          booking.listing.title
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        <DateRange
                          start={booking.startDate}
                          end={booking.endDate}
                        />{" "}
                        · {booking.guests} kişi ·{" "}
                        {formatTRY(Number(booking.totalPrice))}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGES[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>

                  {booking.status === "REJECTED" && booking.rejectionReason ? (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      Red gerekçesi: {booking.rejectionReason}
                    </p>
                  ) : null}

                  {booking.status === "PENDING" ||
                  booking.status === "APPROVED" ? (
                    <BookingActions bookingId={booking.id} mode="cancel" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
