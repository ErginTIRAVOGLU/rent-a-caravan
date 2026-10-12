import type { Metadata } from "next";
import Link from "next/link";
import type { BookingRequestStatus } from "@prisma/client";

import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { formatTRY } from "../../lib/format";
import { getAccountCounts } from "../../server/panel/counts";
import { PageHeader } from "../../components/panel/PageHeader";
import { StatCard } from "../../components/panel/StatCard";
import { PanelCard } from "../../components/panel/PanelCard";
import { EmptyState } from "../../components/panel/EmptyState";
import { BookingActions } from "./taleplerim/BookingActions";

export const metadata: Metadata = {
  title: "Genel Bakış",
};

// `/hesap` Genel Bakış: veriye uyarlanan sahip (gelen talepler) ve alıcı
// (giden talepler) blokları (spec §6, §8). Oturum kapısı `requireUser`;
// sayaçlar kabuk ile aynı çekirdekten (`getAccountCounts`) beslenir ki
// menü rozeti ile stat kartı asla ayrışmasın.

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

/** Ortalama puan: yorum yoksa "—", tam sayıysa ondalıksız, değilse tek hane. */
function ratingValue(avg: number | null): string {
  if (avg === null) return "—";
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

export default async function HesapDashboardPage() {
  const user = await requireUser();

  const [counts, activeListings, incoming, outgoing, ratingAggregate] =
    await Promise.all([
      getAccountCounts(user.id),
      prisma.listing.count({
        where: { ownerId: user.id, status: "ACTIVE" },
      }),
      // Gelen: kullanıcının ilanlarına yapılan talepler (en yeni 5).
      prisma.bookingRequest.findMany({
        where: { listing: { ownerId: user.id } },
        include: {
          listing: { select: { id: true, title: true } },
          renter: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Giden: kullanıcının kiracı olduğu talepler (en yeni 3).
      prisma.bookingRequest.findMany({
        where: { renterId: user.id },
        include: { listing: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      // Ortalama puan: kullanıcının ilanlarına yazılan yorumların ortalaması.
      prisma.review.aggregate({
        where: { listing: { ownerId: user.id } },
        _avg: { rating: true },
      }),
    ]);

  const hasListings = counts.listings > 0;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Hesabım" title="Genel Bakış" />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Yayında ilan"
          value={activeListings}
          icon="rv_hookup"
          tone="success"
          href="/hesap/ilanlarim"
        />
        <StatCard
          label="Bekleyen talep"
          value={counts.pendingIncoming}
          icon="inbox"
          tone="accent"
          href="/hesap/taleplerim"
        />
        <StatCard
          label="Okunmamış mesaj"
          value={counts.unreadMessages}
          icon="chat_bubble"
          tone="primary"
          href="/hesap/mesajlar"
        />
        <StatCard
          label="Ortalama puan"
          value={ratingValue(ratingAggregate._avg.rating)}
          icon="star"
          tone="info"
          href="/hesap/degerlendirmeler"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <PanelCard
          title="Gelen talepler"
          className="lg:col-span-2"
          action={
            hasListings ? (
              <Link
                href="/hesap/taleplerim"
                className="text-body-sm font-semibold text-primary hover:underline"
              >
                Tümünü gör
              </Link>
            ) : undefined
          }
        >
          {!hasListings ? (
            <EmptyState
              icon="rv_hookup"
              title="Henüz ilanınız yok"
              description="Talep almaya başlamak için ilk karavan ilanınızı oluşturun."
              action={
                <Link href="/hesap/ilanlarim/yeni" className="btn btn-accent">
                  İlan ver
                </Link>
              }
            />
          ) : incoming.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="Henüz gelen talep yok"
              description="İlanlarınıza gelen talepler burada listelenir."
            />
          ) : (
            <ul className="space-y-4">
              {incoming.map((booking) => (
                <li
                  key={booking.id}
                  className="rounded-xl border border-outline-variant/60 p-4"
                >
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
                    <span
                      className={`shrink-0 ${STATUS_BADGES[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>

                  {booking.status === "PENDING" ? (
                    <BookingActions bookingId={booking.id} mode="decide" />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title="Giden talepler"
          action={
            outgoing.length > 0 ? (
              <Link
                href="/hesap/taleplerim"
                className="text-body-sm font-semibold text-primary hover:underline"
              >
                Tümünü gör
              </Link>
            ) : undefined
          }
        >
          {outgoing.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="Henüz talebiniz yok"
              description="Beğendiğiniz bir karavan için talep oluşturun."
              action={
                <Link href="/arama" className="btn btn-primary">
                  Karavan Ara
                </Link>
              }
            />
          ) : (
            <ul className="space-y-4">
              {outgoing.map((booking) => (
                <li
                  key={booking.id}
                  className="rounded-xl border border-outline-variant/60 p-4"
                >
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
                    <span
                      className={`shrink-0 ${STATUS_BADGES[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
