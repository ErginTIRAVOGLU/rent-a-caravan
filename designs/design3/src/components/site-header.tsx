"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Compass, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui";

function BrandMark() {
  return (
    <Link href="/" className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" aria-label="Karavan ana sayfa">
      <span className="grid size-10 place-items-center rounded-2xl bg-forest text-white shadow-soft transition-transform duration-150 group-hover:-rotate-3" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="size-6" fill="none">
          <path d="M6 24.5 13 8l4.1 10.2L21.2 11l4.8 13.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.3 17.4h9.1M8.6 23.8h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="25.7" cy="8.1" r="1.7" fill="#E58B52" />
        </svg>
      </span>
      <span className="font-display text-[1.3rem] font-extrabold tracking-[-0.06em] text-forest">karavan<span className="text-accent">.</span></span>
    </Link>
  );
}

const navItems = [
  { href: "/arama", label: "Karavanları keşfet" },
  { href: "/#nasil-calisir", label: "Nasıl çalışır?" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur-sm">
      <div className="page-container flex h-[76px] items-center justify-between gap-4">
        <BrandMark />
        <nav aria-label="Ana navigasyon" className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => <Link key={item.href} className="min-h-11 content-center text-sm font-semibold text-ink-muted transition-colors hover:text-forest" href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/hesap/ilanlarim/yeni" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-colors hover:bg-paper"><Plus size={17} /> Karavanını kirala</Link>
          <ButtonLink href="/giris" variant="outline" size="sm">Giriş yap</ButtonLink>
          <Link href="/kayit" aria-label="Hesap oluştur" className="grid size-11 place-items-center rounded-full bg-sage-pale text-forest transition-colors hover:bg-sage-light"><Compass size={18} /></Link>
        </div>
        <button type="button" className="grid size-11 place-items-center rounded-full border border-line text-forest md:hidden" aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open ? (
        <nav aria-label="Mobil navigasyon" className="border-t border-line bg-white px-5 py-4 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {navItems.map((item) => <Link onClick={() => setOpen(false)} key={item.href} href={item.href} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink hover:bg-paper">{item.label}</Link>)}
            <Link onClick={() => setOpen(false)} href="/hesap/ilanlarim/yeni" className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-ink hover:bg-paper">Karavanını kirala</Link>
            <div className="mt-2 grid grid-cols-2 gap-2"><ButtonLink href="/giris" variant="outline" size="sm">Giriş yap</ButtonLink><ButtonLink href="/kayit" size="sm">Hesap oluştur</ButtonLink></div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
