"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, IconButton, inputClass } from "@/components/ui";
import type { VehicleType } from "@/lib/demo-data";

export type SearchFilterValues = {
  city?: string;
  type?: string;
  min?: string;
  max?: string;
  persons?: string;
};

const types: VehicleType[] = ["Motokaravan", "Campervan", "Çekme karavan"];

export function SearchFilters({ values }: { values: SearchFilterValues }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const triggerContainer = triggerRef.current;
    const focusable = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? []);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      const trigger = triggerContainer?.querySelector<HTMLElement>("button");
      if (trigger) trigger.focus(); else previousFocus?.focus();
    };
  }, [open]);
  return (
    <>
      <div ref={triggerRef} className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <p className="text-sm font-semibold text-ink-muted">Aramanı daralt</p>
        <Button variant="outline" size="sm" aria-expanded={open} aria-controls="search-filter-dialog" onClick={() => setOpen(true)}><SlidersHorizontal size={16} /> Filtreler</Button>
      </div>
      <aside className="hidden rounded-3xl border border-line bg-white p-5 lg:block">
        <FilterForm values={values} />
      </aside>
      {open ? (
        <div id="search-filter-dialog" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="filter-title">
          <button aria-label="Filtreleri kapat" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div ref={panelRef} className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-white p-5 shadow-lift">
            <div className="mb-6 flex items-center justify-between"><h2 id="filter-title" className="font-display text-xl font-bold">Filtreler</h2><IconButton onClick={() => setOpen(false)} className="hover:bg-paper" label="Filtreleri kapat"><X size={20} /></IconButton></div>
            <FilterForm values={values} onSubmit={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterForm({ values, onSubmit }: { values: SearchFilterValues; onSubmit?: () => void }) {
  return (
    <form action="/arama" method="get" onSubmit={onSubmit} className="grid gap-5">
      <div><label htmlFor="filter-city" className="mb-1.5 block text-sm font-bold">Şehir</label><input id="filter-city" name="sehir" className={inputClass} placeholder="Tüm Türkiye" defaultValue={values.city} /></div>
      <div><label htmlFor="filter-type" className="mb-1.5 block text-sm font-bold">Araç tipi</label><select id="filter-type" name="tip" className={inputClass} defaultValue={values.type ?? ""}><option value="">Tüm tipler</option>{types.map((type) => <option key={type}>{type}</option>)}</select></div>
      <fieldset><legend className="mb-2 text-sm font-bold">Gecelik fiyat aralığı</legend><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-ink-muted">En az<input className={inputClass} inputMode="numeric" min="0" name="min" placeholder="₺" defaultValue={values.min} /></label><label className="grid gap-1 text-xs text-ink-muted">En çok<input className={inputClass} inputMode="numeric" min="0" name="max" placeholder="₺" defaultValue={values.max} /></label></div></fieldset>
      <div><label htmlFor="filter-persons" className="mb-1.5 block text-sm font-bold">Kişi kapasitesi</label><select id="filter-persons" name="kisi" className={inputClass} defaultValue={values.persons ?? ""}><option value="">Farketmez</option>{[2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count}+ kişi</option>)}</select></div>
      <Button type="submit" className="w-full">Sonuçları göster</Button>
      <a href="/arama" className="inline-flex min-h-11 items-center justify-center text-center text-sm font-semibold text-ink-muted underline-offset-4 hover:text-forest hover:underline">Filtreleri temizle</a>
    </form>
  );
}
