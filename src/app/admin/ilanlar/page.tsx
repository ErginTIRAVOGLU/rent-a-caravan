import type { Metadata } from "next";
import Link from "next/link";
import type { ListingStatus, Prisma } from "@prisma/client";

import { prisma } from "../../../lib/prisma";
import { PageHeader } from "../../../components/panel/PageHeader";
import {
  StatusTabs,
  type TabOption,
} from "../../../components/panel/StatusTabs";
import { EmptyState } from "../../../components/panel/EmptyState";
import { parseTabValue } from "../../../components/panel/tabs";
import { AdminListingsTable } from "./AdminListingsTable";
import { STATUS_LABELS } from "./listing-status";

export const metadata: Metadata = {
  title: "İlanlar",
};

// `/admin/ilanlar` — durum sekmeleri + sunucu tarafı `?q=` araması + tablo
// (spec §7.4, §8, §9). Dört ayrı bölüm yerine TEK durum listesi render edilir;
// sekmeler URL query'sinde yaşar, istemci durumu yoktur. Eski 50 kayıt sınırı
// kaldırılmıştır (liste MVP ölçeğinde tam yüklenir).

/** Sekme sırası — ilk sekme (`PENDING`) varsayılandır. */
const STATUS_ORDER = ["PENDING", "ACTIVE", "PAUSED", "REJECTED"] as const;
type AdminListingTab = (typeof STATUS_ORDER)[number];

/** Boş sekme başlıkları — duruma özel, tek cümle. */
const EMPTY_TITLE: Record<AdminListingTab, string> = {
  PENDING: "İncelemede ilan yok",
  ACTIVE: "Yayında ilan yok",
  PAUSED: "Askıda ilan yok",
  REJECTED: "Reddedilmiş ilan yok",
};

/** Tek değerli query alanı; dizi/undefined → boş metin. */
function firstValue(raw: string | string[] | undefined): string {
  return typeof raw === "string" ? raw : "";
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const durum = parseTabValue(
    params.durum,
    STATUS_ORDER,
    "PENDING",
  ) as AdminListingTab;
  const q = firstValue(params.q).trim();

  const where: Prisma.ListingWhereInput = {
    status: durum,
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
  };

  const [grouped, listings] = await Promise.all([
    // Sayaçlar `q` uygulanmadan tam durum dağılımını verir.
    prisma.listing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.listing.findMany({
      where,
      include: { owner: { select: { name: true, email: true } } },
      // İnceleme kuyruğu en eski başvuruyu önce gösterir (adil kuyruk, eski
      // sayfadaki "en eski başvuru önce" kararı); diğer durumlar en yeniden
      // eskiye.
      orderBy: { createdAt: durum === "PENDING" ? "asc" : "desc" },
    }),
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

  const tabs: TabOption[] = STATUS_ORDER.map((value) => ({
    value,
    label: STATUS_LABELS[value],
    count: counts[value],
  }));

  // Sekme linkleri mevcut `q` aramasını korur (StatusTabs sözleşmesi).
  const tabBasePath = q
    ? `/admin/ilanlar?q=${encodeURIComponent(q)}`
    : "/admin/ilanlar";
  // "Aramayı temizle" mevcut sekmeyi korur, yalnız `q`'yu düşürür.
  const clearHref =
    durum === "PENDING" ? "/admin/ilanlar" : `/admin/ilanlar?durum=${durum}`;

  const showChrome = total > 0;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Yönetim"
        title="İlanlar"
        description="Bekleyen ilanları inceleyin, onaylayın veya gerekçeyle reddedin."
        actions={
          showChrome ? (
            <form
              method="get"
              action="/admin/ilanlar"
              role="search"
              className="flex items-center gap-2"
            >
              {durum !== "PENDING" ? (
                <input type="hidden" name="durum" value={durum} />
              ) : null}
              <label htmlFor="admin-ilanlar-q" className="sr-only">
                İlan ara
              </label>
              <input
                id="admin-ilanlar-q"
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
          ) : null
        }
      />

      {showChrome ? (
        <div className="mb-4">
          <StatusTabs
            basePath={tabBasePath}
            param="durum"
            tabs={tabs}
            current={durum}
          />
        </div>
      ) : null}

      {listings.length === 0 ? (
        <div className="card">
          {q ? (
            <EmptyState
              icon="search_off"
              title="Aramanızla eşleşen ilan yok"
              description="Farklı bir arama deneyin."
              action={
                <Link href={clearHref} className="btn btn-outline">
                  Aramayı temizle
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon="inbox"
              title={EMPTY_TITLE[durum]}
              description="Bu durumda ilan bulunmuyor."
              action={
                <Link href="/admin" className="btn btn-outline">
                  Genel Bakışa dön
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-2 sm:p-4">
          <AdminListingsTable listings={listings} />
        </div>
      )}
    </div>
  );
}
