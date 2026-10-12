import type { Metadata } from "next";
import Link from "next/link";
import type { BookingRequestStatus, Prisma } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { PageHeader } from "../../../components/panel/PageHeader";
import {
  StatusTabs,
  type TabOption,
} from "../../../components/panel/StatusTabs";
import { EmptyState } from "../../../components/panel/EmptyState";
import { parseTabValue } from "../../../components/panel/tabs";
import {
  RequestTable,
  STATUS_LABELS,
  type RequestDirection,
} from "./RequestTable";

export const metadata: Metadata = {
  title: "Taleplerim",
};

// `/hesap/taleplerim` — Gelen/Giden ana sekmeleri + durum filtreleri + tablo
// (spec §7.3, §8, §9). Sekme ve filtre durumu URL query'sinde yaşar; istemci
// durumu yoktur. Aynı anda YALNIZ seçili yönün listesi render edilir. Sunucu
// bileşeni veriyi çeker, tek istemci adası satır aksiyonlarıdır.

/** Durum sekmesi sırası — spec §8 alt filtreleri. */
const STATUS_ORDER: readonly BookingRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
];

/** İzinli yön sekmeleri — ilk (`incoming`) varsayılandır. */
const ALLOWED_SEKME = ["incoming", "outgoing"] as const;

/** İzinli `durum` değerleri — ilk (`all`) varsayılandır. */
const ALLOWED_DURUM = ["all", ...STATUS_ORDER] as const;

/** groupBy sonucunu tam durum dağılımına çevirir. */
function toCounts(
  groups: { status: BookingRequestStatus; _count: { _all: number } }[],
): Record<BookingRequestStatus, number> {
  const counts: Record<BookingRequestStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
  };
  for (const group of groups) {
    counts[group.status] = group._count._all;
  }
  return counts;
}

function totalOf(counts: Record<BookingRequestStatus, number>): number {
  return STATUS_ORDER.reduce((sum, value) => sum + counts[value], 0);
}

export default async function TaleplerimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const direction = parseTabValue(
    params.sekme,
    ALLOWED_SEKME,
    "incoming",
  ) as RequestDirection;
  const durum = parseTabValue(params.durum, ALLOWED_DURUM, "all");
  const status = durum === "all" ? null : (durum as BookingRequestStatus);

  const directionWhere: Prisma.BookingRequestWhereInput =
    direction === "incoming"
      ? { listing: { ownerId: user.id } }
      : { renterId: user.id };

  const [incomingGroups, outgoingGroups, rows] = await Promise.all([
    // Yön sayaçları kullanıcı kapsamlı; durum filtresinden bağımsız.
    prisma.bookingRequest.groupBy({
      by: ["status"],
      where: { listing: { ownerId: user.id } },
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["status"],
      where: { renterId: user.id },
      _count: { _all: true },
    }),
    // Yalnız seçili yön + durum filtresi; tek liste.
    prisma.bookingRequest.findMany({
      where: { ...directionWhere, ...(status ? { status } : {}) },
      include: {
        listing: { select: { id: true, title: true, status: true } },
        renter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const incomingCounts = toCounts(incomingGroups);
  const outgoingCounts = toCounts(outgoingGroups);
  const incomingTotal = totalOf(incomingCounts);
  const outgoingTotal = totalOf(outgoingCounts);
  const selectedCounts =
    direction === "incoming" ? incomingCounts : outgoingCounts;
  const selectedTotal =
    direction === "incoming" ? incomingTotal : outgoingTotal;

  const mainTabs: TabOption[] = [
    { value: "incoming", label: "Gelen", count: incomingTotal },
    { value: "outgoing", label: "Giden", count: outgoingTotal },
  ];

  const statusTabs: TabOption[] = [
    { value: "all", label: "Tümü", count: selectedTotal },
    ...STATUS_ORDER.map((value) => ({
      value,
      label: STATUS_LABELS[value],
      count: selectedCounts[value],
    })),
  ];

  // Sekme linkleri diğer filtreyi korumalı (StatusTabs sözleşmesi).
  const mainTabsBase =
    durum === "all" ? "/hesap/taleplerim" : `/hesap/taleplerim?durum=${durum}`;
  const statusTabsBase =
    direction === "incoming"
      ? "/hesap/taleplerim"
      : `/hesap/taleplerim?sekme=${direction}`;

  const emptyState =
    direction === "incoming" ? (
      selectedTotal === 0 ? (
        <EmptyState
          icon="inbox"
          title="Henüz gelen talep yok"
          description="İlanlarınıza gelen talepler burada listelenir."
        />
      ) : (
        <EmptyState
          icon="filter_alt_off"
          title="Bu filtreyle eşleşen talep yok"
          description="Farklı bir durum seçin."
        />
      )
    ) : selectedTotal === 0 ? (
      <EmptyState
        icon="search_off"
        title="Henüz talebiniz yok"
        description="Karavan keşfedin ve rezervasyon talebi gönderin."
        action={
          <Link href="/arama" className="btn btn-primary">
            Karavan Ara
          </Link>
        }
      />
    ) : (
      <EmptyState
        icon="filter_alt_off"
        title="Bu filtreyle eşleşen talep yok"
        description="Farklı bir durum seçin."
      />
    );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Hesabım"
        title="Taleplerim"
        description="Gelen talepleri onaylayın ya da reddedin, kendi taleplerinizi takip edin."
      />

      <div className="mb-3">
        <StatusTabs
          basePath={mainTabsBase}
          param="sekme"
          tabs={mainTabs}
          current={direction}
        />
      </div>

      <div className="mb-4">
        <StatusTabs
          basePath={statusTabsBase}
          param="durum"
          tabs={statusTabs}
          current={durum}
        />
      </div>

      {rows.length === 0 ? (
        <div className="card">{emptyState}</div>
      ) : (
        <div className="card overflow-hidden p-2 sm:p-4">
          <RequestTable rows={rows} direction={direction} />
        </div>
      )}
    </div>
  );
}
