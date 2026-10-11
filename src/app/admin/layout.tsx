import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { requireAdmin } from "../../lib/auth";

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
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-surface-mid bg-surface-low">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-12">
          <Link href="/admin" className="text-headline-md font-bold text-primary">
            Yönetim Paneli
          </Link>
          <nav className="flex gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-mid hover:text-primary"
              >
                <span className="material-symbols-outlined text-lg">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}