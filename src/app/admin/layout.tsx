import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { requireAdmin } from "../../lib/auth";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Yönetim — Karavan Kiralama",
};

const NAV_LINKS = [
  { href: "/admin", label: "Genel Bakış", icon: "dashboard" },
  { href: "/admin/ilanlar", label: "İlanlar", icon: "rv_hookup" },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "group" },
  { href: "/admin/sikayetler", label: "Şikayetler", icon: "report_problem" },
  { href: "/admin/ayarlar", label: "Ayarlar", icon: "settings" },
] as const;

/**
 * Yönetim paneli sarmalayıcısı: her istekte `requireAdmin()` — oturum yoksa
 * /giris'e, ADMIN değilse /'e yönlendirir. Yetkisiz kullanıcı panele hiç giremez.
 * Düzen: masaüstünde dikey sidebar (aktif rota vurgulu), dar ekranda yatay
 * kaydırılabilir üst çubuk.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col lg:flex-row">
        {/* Sidebar / üst çubuk */}
        <aside className="border-b border-outline-variant/60 bg-surface-lowest lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="px-4 py-4 sm:px-6 lg:px-5 lg:py-6">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-headline-md font-bold text-primary"
            >
              <span className="material-symbols-outlined text-accent">
                admin_panel_settings
              </span>
              Yönetim
            </Link>
            <div className="mt-4 lg:mt-6">
              <AdminNav items={NAV_LINKS} />
            </div>
            <div className="mt-4 hidden lg:block lg:mt-6 lg:border-t lg:border-outline-variant/60 lg:pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-primary"
              >
                <span className="material-symbols-outlined text-base">
                  arrow_back
                </span>
                Siteye dön
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
