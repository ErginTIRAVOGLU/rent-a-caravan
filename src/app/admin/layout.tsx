import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { requireAdmin } from "../../lib/auth";

export const metadata: Metadata = {
  title: "Yönetim — Karavan Kiralama",
};

const NAV_LINK =
  "rounded-lg px-3 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800 hover:text-white";

/**
 * Yönetim paneli sarmalayıcısı: her istekte `requireAdmin()` — oturum yoksa
 * /giris'e, ADMIN değilse /'e yönlendirir. Yetkisiz kullanıcı panele hiç giremez.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-gray-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg font-bold text-white">Yönetim Paneli</span>
          <nav className="flex flex-wrap gap-1 sm:gap-2">
            <Link href="/admin" className={NAV_LINK}>
              Genel Bakış
            </Link>
            <Link href="/admin/ilanlar" className={NAV_LINK}>
              İlanlar
            </Link>
            <Link href="/admin/kullanicilar" className={NAV_LINK}>
              Kullanıcılar
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
