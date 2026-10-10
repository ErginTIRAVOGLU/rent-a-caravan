"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Eye, Pause, Play, X } from "lucide-react";
import { demoListings } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import { SiteImage } from "@/components/site-image";
import { ConfirmDialog } from "@/components/confirm-dialog";

type ReviewStatus = "İncelemede" | "Yayında" | "Reddedildi" | "Duraklatıldı";
type Action = "approve" | "reject" | "pause" | "resume";
type Row = { listing: (typeof demoListings)[number]; status: ReviewStatus; reason?: string };
const initialRows: Row[] = demoListings.map((listing, index) => ({ listing, status: index === 1 ? "Yayında" : index === 3 ? "Reddedildi" : "İncelemede", reason: index === 3 ? "Fotoğraf ve araç açıklaması yeniden kontrol edilmeli." : undefined }));
const tone = (status: ReviewStatus) => status === "Yayında" ? "success" : status === "İncelemede" ? "warning" : status === "Reddedildi" ? "error" : "neutral";
const actionText: Record<Action, string> = { approve: "onayla", reject: "reddet", pause: "duraklat", resume: "yeniden yayına al" };

export function AdminListingManager() {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState("Tümü");
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [notice, setNotice] = useState("");
  const visible = rows.filter((row) => filter === "Tümü" || row.status === filter);

  function confirmAction() {
    if (!pending) return;
    if (pending.action === "reject" && reason.trim().length < 6) { setReasonError("Reddetmek için en az 6 karakterlik gerekçe yaz."); return; }
    const nextStatus: ReviewStatus = pending.action === "approve" ? "Yayında" : pending.action === "reject" ? "Reddedildi" : pending.action === "pause" ? "Duraklatıldı" : "Yayında";
    setRows((current) => current.map((row) => row.listing.id === pending.id ? { ...row, status: nextStatus, reason: pending.action === "reject" ? reason.trim() : row.reason } : row));
    setNotice(`Demo ilanı ${actionText[pending.action]}. Gerçek bir ilan değişmedi.`);
    setPending(null); setReason(""); setReasonError("");
  }

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-muted">Kararlar yalnızca bu demo oturumunda görünür.</p><div className="flex flex-wrap gap-2" role="group" aria-label="Moderasyon filtresi">{["Tümü", "İncelemede", "Yayında", "Reddedildi", "Duraklatıldı"].map((status) => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)} className={`min-h-11 rounded-full px-3 text-xs font-bold ${filter === status ? "bg-forest text-white" : "border border-line bg-white text-ink-muted"}`}>{status}</button>)}</div></div>
    {notice ? <p className="mb-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info" role="status">{notice}</p> : null}
    <div className="grid gap-3">{visible.map(({ listing, status, reason: rejection }) => <article key={listing.id} className="grid gap-4 rounded-3xl border border-line bg-white p-4 sm:grid-cols-[170px_minmax(0,1fr)] sm:p-5">
      <Link href={`/ilan/${listing.id}`} className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-sage-pale"><SiteImage src={listing.image} alt={`${listing.title} moderasyon örnek fotoğrafı`} fill unoptimized sizes="170px" className="object-cover" /><span className="absolute left-2 top-2"><Badge>Örnek</Badge></span><span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-white"><Eye size={15} /></span></Link>
      <div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-bold text-ink">{listing.title}</h2><Badge tone={tone(status)}>{status}</Badge></div><p className="mt-1 text-sm text-ink-muted">{listing.district}, {listing.city} · {listing.vehicleType} · {listing.brand} {listing.model} ({listing.year})</p><p className="mt-1 text-sm text-ink-muted">Sahip: {listing.hostName} · {formatCurrency(listing.nightlyPrice)} / gece · {listing.capacity} kişi</p>{rejection ? <p className="mt-2 rounded-xl bg-error-soft px-3 py-2 text-xs text-error">Red gerekçesi: {rejection}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">{status === "İncelemede" ? <><Button size="sm" onClick={() => setPending({ id: listing.id, action: "approve" })}><Check size={15} /> Onayla</Button><Button size="sm" variant="outline" onClick={() => { setPending({ id: listing.id, action: "reject" }); setReasonError(""); }}><X size={15} /> Gerekçeli reddet</Button></> : status === "Yayında" ? <Button size="sm" variant="outline" onClick={() => setPending({ id: listing.id, action: "pause" })}><Pause size={15} /> Duraklat</Button> : status === "Duraklatıldı" ? <Button size="sm" variant="outline" onClick={() => setPending({ id: listing.id, action: "resume" })}><Play size={15} /> Yayına al</Button> : null}<Link href={`/ilan/${listing.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-ink-muted hover:bg-paper">İlan önizle <Eye size={14} /></Link></div>
      </div>
    </article>)}</div>
    {!visible.length ? <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-ink-muted">Bu durumda örnek ilan yok.</p> : null}
    <ConfirmDialog open={Boolean(pending)} title={`Demo ilanını ${pending ? actionText[pending.action] : "güncelle"}?`} description="Bu kritik eylem yalnızca yerel örnek durumunu günceller; canlı ilan verisine dokunmaz." confirmLabel={pending?.action === "reject" ? "Gerekçeyle reddet" : "Demo durumunu uygula"} destructive={pending?.action === "reject"} onCancel={() => { setPending(null); setReasonError(""); setReason(""); }} onConfirm={confirmAction}>
      {pending?.action === "reject" ? <label className="mt-4 grid gap-2 text-sm font-bold">Red gerekçesi<textarea autoFocus className="min-h-24 rounded-xl border border-line p-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-forest" value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(""); }} placeholder="Örn. Fotoğraflar yeniden yüklenmeli" />{reasonError ? <span className="text-xs text-error" role="alert">{reasonError}</span> : null}</label> : null}
    </ConfirmDialog>
  </div>;
}
