"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, MoreHorizontal, Pencil, Pause, Play, Plus, Trash2 } from "lucide-react";
import { demoListings } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/utils";
import { Badge, ButtonLink } from "@/components/ui";
import { SiteImage } from "@/components/site-image";
import { ConfirmDialog } from "@/components/confirm-dialog";

const initialStatuses = ["Yayında", "Taslak", "İncelemede", "Reddedildi"] as const;
type Status = (typeof initialStatuses)[number] | "Duraklatıldı";
const statusTone = (status: Status) => status === "Yayında" ? "success" : status === "İncelemede" ? "warning" : status === "Reddedildi" ? "error" : "neutral";

export function ListingManager() {
  type ManagedListing = { listing: (typeof demoListings)[number]; status: Status };
  const [items, setItems] = useState<ManagedListing[]>(() => demoListings.map((listing, index) => ({ listing, status: initialStatuses[index] ?? "Taslak" })));
  const [filter, setFilter] = useState("Tümü");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const shown = items.filter(({ status }) => filter === "Tümü" || status === filter);

  function setStatus(id: string, status: Status) {
    setItems((current) => current.map((item) => item.listing.id === id ? { ...item, status } : item));
  }
  function removeItem() {
    if (deleteId) setItems((current) => current.filter((item) => item.listing.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-ink-muted">İlan durumları yalnızca bu demo oturumunda değişir.</p></div><ButtonLink href="/hesap/ilanlarim/yeni"><Plus size={16} /> Yeni ilan</ButtonLink></div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="İlan durumu filtresi">{["Tümü", "Taslak", "İncelemede", "Yayında", "Reddedildi", "Duraklatıldı"].map((status) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={`min-h-11 rounded-full px-4 text-xs font-bold ${filter === status ? "bg-forest text-white" : "border border-line bg-white text-ink-muted hover:bg-paper"}`}>{status}</button>)}</div>
      <div className="grid gap-3">{shown.map(({ listing, status }) => <article key={listing.id} className="grid gap-4 rounded-3xl border border-line bg-white p-4 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sage-pale sm:aspect-square"><SiteImage src={listing.image} alt={`${listing.title} örnek ilan görseli`} fill unoptimized sizes="150px" className="object-cover" /><span className="absolute left-2 top-2"><Badge>Örnek</Badge></span></div>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-bold text-ink">{listing.title}</h2><Badge tone={statusTone(status)}>{status}</Badge></div><p className="mt-1 text-sm text-ink-muted">{listing.district}, {listing.city} · {listing.vehicleType}</p><p className="mt-2 text-sm font-bold text-ink">{formatCurrency(listing.nightlyPrice)} <span className="font-normal text-ink-muted">/ gece</span></p><div className="mt-3 flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-bold text-ink-muted hover:bg-paper" href={`/ilan/${listing.id}`}><Eye size={14} /> Önizle</Link><Link className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-bold text-ink-muted hover:bg-paper" href={`/hesap/ilanlarim/${listing.id}/duzenle`}><Pencil size={14} /> Düzenle</Link></div></div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {status === "Yayında" ? <button type="button" onClick={() => setStatus(listing.id, "Duraklatıldı")} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted hover:bg-paper"><Pause size={14} /> Duraklat</button> : status === "Duraklatıldı" ? <button type="button" onClick={() => setStatus(listing.id, "Yayında")} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-forest hover:bg-sage-pale"><Play size={14} /> Yayına al</button> : <button type="button" onClick={() => setStatus(listing.id, "İncelemede")} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-forest hover:bg-sage-pale"><MoreHorizontal size={14} /> İncelemeye hazırla</button>}
          <button type="button" onClick={() => setDeleteId(listing.id)} aria-label={`${listing.title} ilanını sil`} className="grid size-11 place-items-center rounded-full text-error hover:bg-error-soft"><Trash2 size={15} /></button>
        </div>
      </article>)}</div>
      {!shown.length ? <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink-muted">Bu durumda örnek ilan yok.</p> : null}
      <ConfirmDialog open={Boolean(deleteId)} title="Örnek ilanı kaldır?" description="Bu işlem yalnızca bu sayfadaki demo listesini değiştirir; sunucuda kayıt silinmez." confirmLabel="Demo listesinden kaldır" destructive onCancel={() => setDeleteId(null)} onConfirm={removeItem} />
    </div>
  );
}
