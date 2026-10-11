"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { signOutAction } from "../lib/auth-actions";

const NAV_LINKS = [
  { href: "/arama", label: "Karavanları Keşfet" },
  { href: "/#nasil-calisir", label: "Nasıl Çalışır?" },
  { href: "/hesap/ilanlarim/yeni", label: "Karavanını Kirala" },
];

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source.slice(0, 1).toUpperCase();
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

export function SiteHeader() {
  const { data: session, status } = useSession();
  const user = session?.user ?? null;

  // Unread message count with SWR polling (15s)
  const { data: unreadCount = 0 } = useSWR("/api/messages/unread-count", fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    fallbackData: 0,
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-surface-mid bg-surface/90 shadow-card backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-12">
        {/* Marka */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/images/logo.png"
            alt=""
            width={112}
            height={28}
            className="h-7 w-auto"
            priority
          />
          <span className="text-title-md font-bold tracking-tight text-primary">
            Karavan Kiralama<span className="text-accent">.</span>
          </span>
        </Link>

        {/* Orta navigasyon */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Sağ aksiyonlar */}
        <div className="flex shrink-0 items-center gap-2">
          {status === "loading" ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-low animate-pulse" aria-hidden="true" />
          ) : user ? (
            <>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn btn-outline btn-sm">
                  <span className="material-symbols-outlined text-base">
                    admin_panel_settings
                  </span>
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              <details className="group relative">
                <summary className="flex list-none cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-label-lg text-primary transition-colors hover:bg-surface-low [&::-webkit-details-marker]:hidden">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-white">
                    {initials(user.name, user.email)}
                  </span>
                  <span className="hidden max-w-28 truncate sm:inline">
                    {user.name || "Hesabım"}
                  </span>
                  {/* Unread message badge */}
                  {unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-base text-outline">
                    expand_more
                  </span>
                </summary>
                <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-outline-variant/60 bg-white p-2 shadow-raised">
                  <div className="mb-1 border-b border-outline-variant px-3 pb-2 pt-1">
                    <p className="text-label-md text-on-surface-variant">
                      Oturum
                    </p>
                    <p className="truncate text-body-md font-semibold text-on-surface">
                      {user.email}
                    </p>
                  </div>
                  <Link href="/hesap/taleplerim" className="menu-item">
                    <span className="material-symbols-outlined text-lg text-secondary">
                      inbox
                    </span>
                    Taleplerim
                  </Link>
                  <Link href="/hesap/ilanlarim" className="menu-item">
                    <span className="material-symbols-outlined text-lg text-secondary">
                      rv_hookup
                    </span>
                    İlanlarım
                  </Link>
                  <Link href="/hesap/profil" className="menu-item">
                    <span className="material-symbols-outlined text-lg text-secondary">
                      person
                    </span>
                    Profil
                  </Link>
                  {/* form action: signOut içindeki redirect Next tarafından ele alınır */}
                  <form action={signOutAction} className="mt-1 border-t border-outline-variant pt-1">
                    <button type="submit" className="menu-item text-error hover:bg-error-bg">
                      <span className="material-symbols-outlined text-lg">
                        logout
                      </span>
                      Çıkış
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/giris" className="btn btn-accent btn-sm">
                Giriş Yap
              </Link>
              <Link href="/kayit" className="btn btn-primary btn-sm">
                Kayıt Ol
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}