"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { signOutAction } from "../../lib/auth-actions";

/**
 * Bildirim zili config'i. `endpoint` verilirse canlı sayaç SWR ile çekilir
 * (mevcut `/api/messages/unread-count` deseni); aksi halde sunucudan gelen
 * `count` kullanılır. Zil her zaman `href`'e gider.
 */
export type PanelNotifications = {
  href: string;
  count?: number;
  endpoint?: string | null;
};

type PanelTopbarProps = {
  notifications?: PanelNotifications;
};

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source.slice(0, 1).toUpperCase();
}

function formatCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function buildValidatedUrl(baseUrl: string): string {
  try {
    if (baseUrl.includes("/../") || /\/%2e%2e\//i.test(baseUrl)) {
      throw new Error("Invalid path");
    }
    const url = new URL(baseUrl, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Invalid protocol");
    }
    if (url.origin !== window.location.origin) {
      throw new Error("Invalid host");
    }
    return url.href;
  } catch {
    throw new Error("Invalid URL");
  }
}

function fetcher(url: string): Promise<number> {
  return fetch(buildValidatedUrl(url)).then((res) => {
    if (!res.ok) return 0;
    return res.json().then((j: { count?: unknown }) =>
      typeof j.count === "number" ? j.count : 0,
    );
  });
}

/**
 * Panel üst çubuğu — panel içi arama kutusu YOKTUR (arama her listenin kendi
 * başlığında, sunucu tarafı `?q=`). Yalnız bildirim zili + kullanıcı menüsü
 * render eder; site header'ındaki mevcut desen yeniden kullanılır.
 */
export function PanelTopbar({ notifications }: PanelTopbarProps) {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Rota değişiminde kullanıcı menüsünü kapat.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
  }

  // Menü açıkken: dışarı tıklama ve Escape ile kapat.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Canlı okunmamış sayacı (yalnız endpoint verildiğinde; çıkışlı durumda
  // istek atılmaz). `count` prop'u endpoint yokken kullanılır.
  const { data: liveCount = 0 } = useSWR(
    notifications?.endpoint ?? null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      fallbackData: 0,
    },
  );

  const notificationCount = notifications
    ? notifications.endpoint
      ? liveCount
      : notifications.count ?? 0
    : 0;

  return (
    <div className="ml-auto flex items-center gap-2">
      {notifications ? (
        <Link
          href={notifications.href}
          aria-label={
            notificationCount > 0
              ? `Bildirimler, ${formatCount(notificationCount)} yeni`
              : "Bildirimler"
          }
          title="Bildirimler"
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-primary"
        >
          <span className="material-symbols-outlined text-xl">
            notifications
          </span>
          {notificationCount > 0 ? (
            <span
              data-testid="panel-notification-badge"
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
            >
              {formatCount(notificationCount)}
            </span>
          ) : null}
        </Link>
      ) : null}

      {status === "loading" ? (
        <div
          className="h-9 w-9 animate-pulse rounded-full bg-surface-low"
          aria-hidden="true"
        />
      ) : user ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Hesap menüsü"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-label-lg text-primary transition-colors hover:bg-surface-low"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-white">
              {initials(user.name, user.email)}
            </span>
            <span className="hidden max-w-28 truncate sm:inline">
              {user.name || "Hesabım"}
            </span>
            <span className="material-symbols-outlined text-base text-outline">
              expand_more
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-outline-variant/60 bg-white p-2 shadow-raised"
            >
              <div className="mb-1 border-b border-outline-variant px-3 pb-2 pt-1">
                <p className="text-label-md text-on-surface-variant">Oturum</p>
                <p className="truncate text-body-md font-semibold text-on-surface">
                  {user.email}
                </p>
              </div>
              <Link
                href="/hesap/taleplerim"
                className="menu-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-lg text-secondary">
                  inbox
                </span>
                Taleplerim
              </Link>
              <Link
                href="/hesap/ilanlarim"
                className="menu-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-lg text-secondary">
                  rv_hookup
                </span>
                İlanlarım
              </Link>
              <Link
                href="/hesap/profil"
                className="menu-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <span className="material-symbols-outlined text-lg text-secondary">
                  person
                </span>
                Profil
              </Link>
              <form
                action={signOutAction}
                className="mt-1 border-t border-outline-variant pt-1"
              >
                <button
                  type="submit"
                  className="menu-item text-error hover:bg-error-bg"
                >
                  <span className="material-symbols-outlined text-lg">
                    logout
                  </span>
                  Çıkış
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
