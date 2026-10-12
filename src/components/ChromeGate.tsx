"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Panel rotası mı? `/hesap` ve `/admin` ile tam ya da segment sınırında
 * başlayan yollar panel sayılır (`/hesaplar` gibi önek tuzakları hariç).
 */
export function isPanelPath(pathname: string): boolean {
  return (
    pathname === "/hesap" ||
    pathname.startsWith("/hesap/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

/**
 * Site chrome (header + üst boşluk + footer) kapısı. Panel rotalarında yalnız
 * `children` render edilir — panel kabuğu kendi sidebar/topbar'ını kurar.
 * Diğer rotalarda site header/footer ve sabit header için `pt-20` boşluğu
 * korunur. `children` sunucu bileşeni olarak prop geçtiği için SSR bozulmaz.
 */
export function ChromeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isPanelPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader />
      {/* Sabit header için üst boşluk; ana sayfa hero'su -mt-20 ile altına girer. */}
      <div className="flex-1 pt-20">{children}</div>
      <SiteFooter />
    </>
  );
}
