import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "../../lib/prisma";

export const metadata: Metadata = {
  title: "Genel Bakış — Yönetim",
};

/**
 * Yönetim genel bakışı: canlı sayaçlar. Şikâyet (Report) modeli DB'de vardır
 * ancak şikâyet yönetim akışı Plan 2'de — burada yalnızca açık şikâyet sayısı
 * gösterilir.
 */
export default async function AdminDashboardPage() {
  const [pendingListings, activeListings, userCount, openReports] =
    await Promise.all([
      prisma.listing.count({ where: { status: "PENDING" } }),
      prisma.listing.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.report.count({ where: { status: "OPEN" } }),
    ]);

  const cards = [
    {
      label: "Bekleyen ilan",
      value: pendingListings,
      href: "/admin/ilanlar",
      hint: "İnceleme sırasındaki ilanlar",
    },
    {
      label: "Aktif ilan",
      value: activeListings,
      href: "/admin/ilanlar",
      hint: "Yayında olan ilanlar",
    },
    {
      label: "Kullanıcı",
      value: userCount,
      href: "/admin/kullanicilar",
      hint: "Kayıtlı tüm hesaplar",
    },
    {
      label: "Açık şikâyet",
      value: openReports,
      href: null,
      hint: "Şikâyet yönetimi yakında",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Genel Bakış</h1>
      <p className="mt-1 text-sm text-gray-600">
        Platformun güncel durumu ve bekleyen moderasyon işleri.
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const body = (
            <>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-1 font-semibold text-gray-800">{card.label}</p>
              <p className="mt-1 text-sm text-gray-600">{card.hint}</p>
            </>
          );
          return (
            <li key={card.label}>
              {card.href ? (
                <Link
                  href={card.href}
                  className="block rounded-2xl bg-white p-5 shadow-sm hover:bg-emerald-50"
                >
                  {body}
                </Link>
              ) : (
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
