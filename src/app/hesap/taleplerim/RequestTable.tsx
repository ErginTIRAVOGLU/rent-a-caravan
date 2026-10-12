import { Fragment } from "react";
import Link from "next/link";
import type {
  BookingRequestStatus,
  ListingStatus,
  Prisma,
} from "@prisma/client";

import { formatTRY } from "../../../lib/format";
import { BookingActions } from "./BookingActions";

// Talep listesi sunumu — masaüstünde gerçek `<table>`, mobilde aynı veriyi
// taşıyan kartlar (tek veri, iki sunum; `md:` kırılımı). Sunucu bileşeni;
// tek istemci adası satır aksiyonlarıdır (`BookingActions`).

/** Durum rozetleri — arayüz metni Türkçe, DB değeri İngilizce. */
export const STATUS_LABELS: Record<BookingRequestStatus, string> = {
  PENDING: "Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal",
  COMPLETED: "Tamamlandı",
};

export const STATUS_BADGES: Record<BookingRequestStatus, string> = {
  PENDING: "badge badge-warning",
  APPROVED: "badge badge-success",
  REJECTED: "badge badge-error",
  CANCELLED: "badge badge-neutral",
  COMPLETED: "badge badge-info",
};

/** İlan durumu etiketleri (giden satırda gösterilir). */
const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "İncelemede",
  ACTIVE: "Yayında",
  REJECTED: "Reddedildi",
  PAUSED: "Askıda",
};

export type RequestDirection = "incoming" | "outgoing";

/** Sunumun ihtiyaç duyduğu minimal rezervasyon talebi şekli. */
export type RequestRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  guests: number;
  totalPrice: Prisma.Decimal | number;
  message: string | null;
  status: BookingRequestStatus;
  rejectionReason: string | null;
  listing: { id: string; title: string; status: ListingStatus };
  renter: { name: string };
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

/** İlan başlığı — giden ve yayındaki ilanda detay sayfasına bağlanır. */
function Title({ row, direction }: { row: RequestRow; direction: RequestDirection }) {
  if (direction === "outgoing" && row.listing.status === "ACTIVE") {
    return (
      <Link
        href={`/ilan/${row.listing.id}`}
        className="font-semibold text-on-surface hover:text-primary hover:underline"
      >
        {row.listing.title}
      </Link>
    );
  }
  return <span className="font-semibold text-on-surface">{row.listing.title}</span>;
}

/** Gelen → kiracı adı; giden → ilan durumu. */
function SecondaryLabel({
  row,
  direction,
}: {
  row: RequestRow;
  direction: RequestDirection;
}) {
  return (
    <span>
      {direction === "incoming"
        ? `Kiracı: ${row.renter.name}`
        : LISTING_STATUS_LABELS[row.listing.status]}
    </span>
  );
}

function MessagePreview({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-2 break-words rounded-lg bg-surface-low p-3 text-body-md text-on-surface-variant">
      “{message}”
    </p>
  );
}

/** Giden reddedilen kayıtta red gerekçesi — satır altında vurgulu. */
function RejectionNote({
  row,
  direction,
}: {
  row: RequestRow;
  direction: RequestDirection;
}) {
  if (
    direction !== "outgoing" ||
    row.status !== "REJECTED" ||
    !row.rejectionReason
  ) {
    return null;
  }
  return (
    <p className="break-words rounded-lg bg-error-bg p-3 text-body-md text-error">
      Red gerekçesi: {row.rejectionReason}
    </p>
  );
}

function RowActions({
  row,
  direction,
}: {
  row: RequestRow;
  direction: RequestDirection;
}) {
  if (direction === "incoming" && row.status === "PENDING") {
    return <BookingActions bookingId={row.id} mode="decide" />;
  }
  if (
    direction === "outgoing" &&
    (row.status === "PENDING" || row.status === "APPROVED")
  ) {
    return <BookingActions bookingId={row.id} mode="cancel" />;
  }
  return null;
}

export function RequestTable({
  rows,
  direction,
}: {
  rows: RequestRow[];
  direction: RequestDirection;
}) {
  return (
    <>
      {/* Masaüstü tablo sunumu. */}
      <div
        data-testid="requests-table"
        data-direction={direction}
        className="hidden overflow-x-auto md:block"
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/60 text-label-md uppercase tracking-wider text-on-surface-variant">
              <th scope="col" className="px-3 py-3 font-medium">
                İlan
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                {direction === "incoming" ? "Kiracı" : "İlan Durumu"}
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Tarih
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Kişi
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Tutar
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
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-b border-outline-variant/40 align-top last:border-0">
                  <td className="px-3 py-4">
                    <Title row={row} direction={direction} />
                    <MessagePreview message={row.message} />
                  </td>
                  <td className="px-3 py-4 text-on-surface-variant">
                    <SecondaryLabel row={row} direction={direction} />
                  </td>
                  <td className="px-3 py-4 text-on-surface-variant">
                    <DateRange start={row.startDate} end={row.endDate} />
                  </td>
                  <td className="px-3 py-4 text-on-surface-variant">
                    {row.guests} kişi
                  </td>
                  <td className="px-3 py-4 text-on-surface">
                    {formatTRY(Number(row.totalPrice))}
                  </td>
                  <td className="px-3 py-4">
                    <span className={`shrink-0 ${STATUS_BADGES[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <RowActions row={row} direction={direction} />
                  </td>
                </tr>
                {direction === "outgoing" &&
                row.status === "REJECTED" &&
                row.rejectionReason ? (
                  <tr className="border-b border-outline-variant/40 last:border-0">
                    <td colSpan={7} className="px-3 pb-4 pt-0">
                      <RejectionNote row={row} direction={direction} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kart sunumu — aynı veri. */}
      <ul
        data-testid="requests-cards"
        data-direction={direction}
        className="space-y-4 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-outline-variant/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate">
                  <Title row={row} direction={direction} />
                </h2>
                <div className="mt-1 flex flex-wrap gap-x-3 text-body-md text-on-surface-variant">
                  <SecondaryLabel row={row} direction={direction} />
                  <DateRange start={row.startDate} end={row.endDate} />
                  <span>{row.guests} kişi</span>
                  <span>{formatTRY(Number(row.totalPrice))}</span>
                </div>
              </div>
              <span className={`shrink-0 ${STATUS_BADGES[row.status]}`}>
                {STATUS_LABELS[row.status]}
              </span>
            </div>

            <MessagePreview message={row.message} />

            {direction === "outgoing" &&
            row.status === "REJECTED" &&
            row.rejectionReason ? (
              <div className="mt-3">
                <RejectionNote row={row} direction={direction} />
              </div>
            ) : null}

            <RowActions row={row} direction={direction} />
          </li>
        ))}
      </ul>
    </>
  );
}
