import type { Metadata } from "next";
import Link from "next/link";
import type { BookingRequestStatus } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { formatTRY } from "../../../lib/format";
import { prisma } from "../../../lib/prisma";
import { AccountNav } from "../../../components/AccountNav";
import { BookingActions } from "./BookingActions";

export const metadata: Metadata = {
  title: "Taleplerim",
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
  PENDING: "badge badge-warning",
  APPROVED: "badge badge-success",
  REJECTED: "badge badge-error",
  CANCELLED: "badge badge-neutral",
  COMPLETED: "badge badge-info",
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <span className="eyebrow">Hesabım</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Taleplerim</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Gelen talepleri onaylayın ya da reddedin, kendi taleplerinizi takip edin.
        </p>
      </header>

      <AccountNav current="taleplerim" />

      {/* GELEN */}
      <section className="mt-8">
        <h2 className="section-title">Gelen Talepler</h2>
        {incoming.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">
              inbox
            </span>
            <p className="mt-2 font-semibold text-on-surface">Henüz gelen talep yok</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {incoming.map((booking) => (
              <li key={booking.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">
                      {booking.listing.title}
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      <DateRange
                        start={booking.startDate}
                        end={booking.endDate}
                      />{" "}
                      · {booking.guests} kişi ·{" "}
                      {formatTRY(Number(booking.totalPrice))}
                    </p>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      Kiracı: {booking.renter.name}
                    </p>
                  </div>
                  <span className={`shrink-0 ${STATUS_BADGES[booking.status]}`}>
                    {STATUS_LABELS[booking.status]}
                  </span>
                </div>

                {booking.message ? (
                  <p className="mt-3 break-words rounded-lg bg-surface-low p-3 text-body-md text-on-surface-variant">
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
        <h2 className="section-title">Giden Taleplerim</h2>
        {outgoing.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">
              search_off
            </span>
            <p className="mt-2 font-semibold text-on-surface">Henüz talebiniz yok</p>
            <Link href="/arama" className="btn btn-primary btn-sm mt-4">
              Karavan Arayın
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {outgoing.map((booking) => (
              <li key={booking.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">
                      {booking.listing.status === "ACTIVE" ? (
                        <Link
                          href={`/ilan/${booking.listing.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {booking.listing.title}
                        </Link>
                      ) : (
                        booking.listing.title
                      )}
                    </h3>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                      <DateRange
                        start={booking.startDate}
                        end={booking.endDate}
                      />{" "}
                      · {booking.guests} kişi ·{" "}
                      {formatTRY(Number(booking.totalPrice))}
                    </p>
                  </div>
                  <span className={`shrink-0 ${STATUS_BADGES[booking.status]}`}>
                    {STATUS_LABELS[booking.status]}
                  </span>
                </div>

                {booking.status === "REJECTED" && booking.rejectionReason ? (
                  <p className="mt-3 break-words rounded-lg bg-error-bg p-3 text-body-md text-error">
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
  );
}
