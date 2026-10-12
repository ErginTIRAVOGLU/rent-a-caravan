import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { requireAdmin } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { PageHeader } from "../../../components/panel/PageHeader";
import {
  StatusTabs,
  type TabOption,
} from "../../../components/panel/StatusTabs";
import { EmptyState } from "../../../components/panel/EmptyState";
import { parseTabValue } from "../../../components/panel/tabs";
import { AdminUsersTable } from "./AdminUsersTable";

export const metadata: Metadata = {
  title: "Kullanıcılar",
};

// `/admin/kullanicilar` — `durum` sekmeleri (Tümü/Aktif/Banlı) + sunucu tarafı
// `?q=` araması (ad veya e-posta). Rol/ban rozetleri ve ban aksiyonu korunur.
// Ban korumaları (kendi hesap, son aktif yönetici) service'te uygulanır; hata
// satırda Türkçe gösterilir.

/** Sekme sırası — ilk sekme (`all`) varsayılandır. */
const ALLOWED_DURUM = ["all", "active", "banned"] as const;
type AdminUserTab = (typeof ALLOWED_DURUM)[number];

/** Tek değerli query alanı; dizi/undefined → boş metin. */
function firstValue(raw: string | string[] | undefined): string {
  return typeof raw === "string" ? raw : "";
}

/** Boş sekme başlığı — duruma (ve toplam sıfıra) özel, tek cümle. */
function emptyTitle(tab: AdminUserTab, total: number): string {
  if (total === 0) {
    return "Kayıtlı kullanıcı yok";
  }
  if (tab === "active") {
    return "Aktif kullanıcı yok";
  }
  if (tab === "banned") {
    return "Banlı kullanıcı yok";
  }
  return "Kullanıcı yok";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;

  const durum = parseTabValue(
    params.durum,
    ALLOWED_DURUM,
    "all",
  ) as AdminUserTab;
  const q = firstValue(params.q).trim();

  const isBanned = durum === "all" ? undefined : durum === "banned";
  const where: Prisma.UserWhereInput = {
    ...(isBanned === undefined ? {} : { isBanned }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [grouped, users] = await Promise.all([
    // Sayaçlar `q` uygulanmadan tam dağılımı verir.
    prisma.user.groupBy({ by: ["isBanned"], _count: { _all: true } }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // passwordHash render kapsamına hiç alınmaz (asgari yetki hijyeni).
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
    }),
  ]);

  let active = 0;
  let banned = 0;
  for (const row of grouped) {
    if (row.isBanned) {
      banned += row._count._all;
    } else {
      active += row._count._all;
    }
  }
  const total = active + banned;

  const tabs: TabOption[] = [
    { value: "all", label: "Tümü", count: total },
    { value: "active", label: "Aktif", count: active },
    { value: "banned", label: "Banlı", count: banned },
  ];

  const tabBasePath = q
    ? `/admin/kullanicilar?q=${encodeURIComponent(q)}`
    : "/admin/kullanicilar";
  const clearHref =
    durum === "all"
      ? "/admin/kullanicilar"
      : `/admin/kullanicilar?durum=${durum}`;

  const showChrome = total > 0;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Yönetim"
        title="Kullanıcılar"
        description="Kayıtlı hesapları inceleyin; gerektiğinde banlayın veya banı açın."
        actions={
          showChrome ? (
            <form
              method="get"
              action="/admin/kullanicilar"
              role="search"
              className="flex items-center gap-2"
            >
              {durum !== "all" ? (
                <input type="hidden" name="durum" value={durum} />
              ) : null}
              <label htmlFor="admin-kullanicilar-q" className="sr-only">
                Kullanıcı ara
              </label>
              <input
                id="admin-kullanicilar-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Ad veya e-posta ara"
                className="input h-11 w-44 sm:w-60"
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

      {users.length === 0 ? (
        <div className="card">
          {q ? (
            <EmptyState
              icon="search_off"
              title="Aramanızla eşleşen kullanıcı yok"
              description="Farklı bir arama deneyin."
              action={
                <Link href={clearHref} className="btn btn-outline">
                  Aramayı temizle
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon="group"
              title={emptyTitle(durum, total)}
              description="Bu durumda kullanıcı bulunmuyor."
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
          <AdminUsersTable users={users} adminId={admin.id} />
        </div>
      )}
    </div>
  );
}
