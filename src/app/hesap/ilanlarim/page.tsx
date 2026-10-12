import type { Metadata } from "next";
import Link from "next/link";
import type { ListingStatus, Prisma } from "@prisma/client";

import { requireUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { PageHeader } from "../../../components/panel/PageHeader";
import {
  StatusTabs,
  type TabOption,
} from "../../../components/panel/StatusTabs";
import { EmptyState } from "../../../components/panel/EmptyState";
import { parseTabValue } from "../../../components/panel/tabs";
import { ListingTable, STATUS_LABELS } from "./ListingTable";

export const metadata: Metadata = {
  title: "İlanlarım",
};

// `/hesap/ilanlarim` — durum sekmeleri + sunucu tarafı `?q=` araması + tablo
// (spec §7.4, §8, §9). Sekme ve arama durumu URL query'sinde yaşar; istemci
// durumu yoktur. Sunucu bileşeni veriyi çeker, tek istemci adası satır
// aksiyonlarıdır (`ListingActions`).

/** Sekme sırası — spec §8: Tümü / Taslak / İncelemede / Yayında / Askıda / Reddedildi. */
const STATUS_ORDER: readonly ListingStatus[] = [
  "DRAFT",
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "REJECTED",
];

/** İzinli `durum` değerleri — ilk sekme (`all`) varsayılandır. */
const ALLOWED_DURUM = ["all", ...STATUS_ORDER] as const;

/** Tek değerli query alanı; dizi/undefined → boş metin. */
function firstValue(raw: string | string[] | undefined): string {
  return typeof raw === "string" ? raw : "";
}

export default async function IlanlarimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const durum = parseTabValue(params.durum, ALLOWED_DURUM, "all");
  const q = firstValue(params.q).trim();
  const status = durum === "all" ? null : (durum as ListingStatus);

  const where: Prisma.ListingWhereInput = {
    ownerId: user.id,
    ...(status ? { status } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const [grouped, listings] = await Promise.all([
    // Sayaçlar `q` uygulanmadan, kullanıcı kapsamlı tam durum dağılımını verir.
    prisma.listing.groupBy({
      by: ["status"],
      where: { ownerId: user.id },
      _count: { _all: true },
    }),
    prisma.listing.findMany({ where, orderBy: { createdAt: "desc" } }),
  ]);

  const counts: Record<ListingStatus, number> = {
    DRAFT: 0,
    PENDING: 0,
    ACTIVE: 0,
    PAUSED: 0,
    REJECTED: 0,
  };
  for (const row of grouped) {
    counts[row.status] = row._count._all;
  }
  const total = STATUS_ORDER.reduce((sum, value) => sum + counts[value], 0);
  const hasAny = total > 0;

  const tabs: TabOption[] = [
    { value: "all", label: "Tümü", count: total },
    ...STATUS_ORDER.map((value) => ({
      value,
      label: STATUS_LABELS[value],
      count: counts[value],
    })),
  ];

  // Sekme linkleri mevcut `q` aramasını korumalı (StatusTabs sözleşmesi).
  const tabBasePath = q
    ? `/hesap/ilanlarim?q=${encodeURIComponent(q)}`
    : "/hesap/ilanlarim";

  const createCta = (
    <Link href="/hesap/ilanlarim/yeni" className="btn btn-primary">
      İlk ilanınızı oluşturun
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Hesabım"
        title="İlanlarım"
        description="Karavan ilanlarınızı oluşturun ve durumlarını takip edin."
        actions={
          <>
            {hasAny ? (
              <form
                method="get"
                action="/hesap/ilanlarim"
                role="search"
                className="flex items-center gap-2"
              >
                {status ? (
                  <input type="hidden" name="durum" value={status} />
                ) : null}
                <label htmlFor="ilanlarim-q" className="sr-only">
                  İlan ara
                </label>
                <input
                  id="ilanlarim-q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="İlan ara"
                  className="input h-11 w-40 sm:w-56"
                />
                <button
                  type="submit"
                  aria-label="Ara"
                  className="btn btn-outline shrink-0"
                >
                  <span className="material-symbols-outlined text-lg">
                    search
                  </span>
                </button>
              </form>
            ) : null}
            <Link
              href="/hesap/ilanlarim/yeni"
              className="btn btn-primary shrink-0"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Yeni İlan
            </Link>
          </>
        }
      />

      {hasAny ? (
        <div className="mb-4">
          <StatusTabs
            basePath={tabBasePath}
            param="durum"
            tabs={tabs}
            current={durum}
          />
        </div>
      ) : null}

      {!hasAny ? (
        <div className="card">
          <EmptyState
            icon="rv_hookup"
            title="Henüz ilanınız yok"
            description="İlan oluşturarak talepleri toplamaya başlayın."
            action={createCta}
          />
        </div>
      ) : listings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="search_off"
            title="Aramanızla eşleşen ilan yok"
            description="Farklı bir arama deneyin veya yeni bir ilan oluşturun."
            action={createCta}
          />
        </div>
      ) : (
        <div className="card overflow-hidden p-2 sm:p-4">
          <ListingTable listings={listings} />
        </div>
      )}
    </div>
  );
}
