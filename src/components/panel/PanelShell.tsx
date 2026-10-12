"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { PanelSidebar } from "./PanelSidebar";
import { PanelTopbar, type PanelNotifications } from "./PanelTopbar";
import type { PanelNavItem } from "./nav";

/** Offcanvas tetikleyicisinin `aria-controls` hedefi. */
export const PANEL_SIDEBAR_ID = "panel-sidebar";

/** Masaüstü kenar çubuğu kırılımı — `lg:` ile aynı olmalı. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Masaüstü algılama. SSR ve `matchMedia`'sız ortamlarda (ör. testler) masaüstü
 * varsayar; böylece masaüstü kenar çubuğu ilk boyamada da kullanılabilir kalır.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

type PanelShellProps = {
  items: readonly PanelNavItem[];
  /** Sidebar marka/rol başlığı. */
  brand?: { href: string; label: string; icon: string };
  /** Sidebar alt CTA'sı (ör. "+ Yeni İlan"). */
  cta?: { href: string; label: string };
  /** Sidebar menü erişilebilirlik etiketi. */
  navLabel?: string;
  /** Topbar bildirim zili config'i. */
  notifications?: PanelNotifications;
  /** Sunucu bileşeni içerik (RSC olarak prop geçer). */
  children: ReactNode;
};

/**
 * Ortak panel kabuğu: masaüstünde sabit sidebar (lg:), mobilde offcanvas
 * (hamburger ile açılır; Escape ve rota değişiminde kapanır) + topbar + main.
 * `children` sunucu bileşeni olarak prop geçtiği için SSR bozulmaz.
 */
export function PanelShell({
  items,
  brand,
  cta,
  navLabel,
  notifications,
  children,
}: PanelShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isDesktop = useIsDesktop();

  // Mobilde kapalı offcanvas; erişilebilirlik ağacından ve sekme sırasından
  // çıkarılır. Masaüstünde (`isDesktop`) kenar çubuğu her zaman kullanılabilir.
  const drawerHidden = !isDesktop && !open;

  // Rota değişiminde offcanvas'ı kapat — prop değişiminde render sırasında
  // ayarlama (effect'te setState kademeli render tetikler).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Offcanvas açıkken Escape ile kapat.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Mobil arka plan perdesi — tıklamayla kapatır. */}
      {open ? (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-on-surface/40 lg:hidden"
        />
      ) : null}

      <aside
        id={PANEL_SIDEBAR_ID}
        inert={drawerHidden}
        aria-hidden={drawerHidden ? true : undefined}
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-outline-variant/60 bg-surface-lowest transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <PanelSidebar
          items={items}
          brand={brand}
          cta={cta}
          navLabel={navLabel}
          onNavigate={() => setOpen(false)}
        />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-outline-variant/60 bg-surface/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Menü"
            aria-expanded={open}
            aria-controls={PANEL_SIDEBAR_ID}
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-primary lg:hidden"
          >
            <span className="material-symbols-outlined text-xl">
              {open ? "close" : "menu"}
            </span>
          </button>
          <PanelTopbar notifications={notifications} />
        </header>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
