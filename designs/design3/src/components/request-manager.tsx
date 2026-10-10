"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, X } from "lucide-react";
import { demoListings, type RequestStatus } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";

type DemoRequest = {
  id: string;
  listingId: string;
  person: string;
  dates: string;
  people: number;
  nights: number;
  status: RequestStatus;
  direction: "incoming" | "outgoing";
  reason?: string;
};

const seed: DemoRequest[] = [
  { id: "req-1", listingId: "ege-rotasi", person: "Ada Yıldız", dates: "20–22 Ekim 2026", people: 2, nights: 2, status: "Bekliyor", direction: "incoming" },
  { id: "req-2", listingId: "orman-yuvasi", person: "Baran Akın", dates: "2–4 Kasım 2026", people: 3, nights: 2, status: "Onaylandı", direction: "outgoing" },
  { id: "req-3", listingId: "yayla-konforu", person: "Mina Kılıç", dates: "8–11 Aralık 2026", people: 4, nights: 3, status: "Bekliyor", direction: "incoming" },
  { id: "req-4", listingId: "kapadokya-yolu", person: "Efe Demir", dates: "12–15 Eylül 2026", people: 2, nights: 3, status: "Reddedildi", direction: "outgoing", reason: "Araç bu tarih aralığında uygun değildi." },
  { id: "req-5", listingId: "orman-yuvasi", person: "Duru Arı", dates: "5–7 Kasım 2026", people: 2, nights: 2, status: "İptal edildi", direction: "incoming" },
  { id: "req-6", listingId: "ege-rotasi", person: "Can Öz", dates: "5–8 Eylül 2026", people: 2, nights: 3, status: "Tamamlandı", direction: "outgoing" },
];
const statusTone = (status: RequestStatus) => status === "Onaylandı" || status === "Tamamlandı" ? "success" : status === "Bekliyor" ? "warning" : status === "Reddedildi" ? "error" : "neutral";

export function RequestManager() {
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const [requests, setRequests] = useState(seed);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const visible = requests.filter((item) => item.direction === tab);
  const listingFor = (id: string) => demoListings.find((item) => item.id === id);

  function changeStatus(id: string, status: RequestStatus, decisionReason?: string) {
    setRequests((current) => current.map((item) => item.id === id ? { ...item, status, reason: decisionReason ?? item.reason } : item));
    setFeedback("Durum yalnızca bu demo görünümünde güncellendi; gerçek bir talep değişmedi.");
    setRejectId(null);
    setReason("");
  }

  function rejectRequest(id: string) {
    if (reason.trim().length < 6) {
      setFeedback("Red gerekçesi en az 6 karakter olmalı.");
      return;
    }
    changeStatus(id, "Reddedildi", reason.trim());
  }

  return (
    <div>
      <div className="mb-5 flex gap-2 border-b border-line" role="tablist" aria-label="Talep yönü">{([["incoming", "Bana gelen"], ["outgoing", "Gönderdiklerim"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setFeedback(""); }} className={`min-h-12 border-b-2 px-4 text-sm font-bold ${tab === key ? "border-forest text-forest" : "border-transparent text-ink-muted hover:text-ink"}`}>{label}<span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs">{requests.filter((item) => item.direction === key).length}</span></button>)}</div>
      {feedback ? <p className="mb-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info" role="status">{feedback}</p> : null}
      {visible.length ? <div className="grid gap-3">{visible.map((request) => {
        const listing = listingFor(request.listingId);
        if (!listing) return null;
        const total = listing.nightlyPrice * request.nights;
        return <article key={request.id} className="rounded-3xl border border-line bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-sage-strong">{tab === "incoming" ? "Kiracı" : "İlan sahibi"}</p><h2 className="mt-1 font-display text-lg font-bold">{request.person}</h2></div><Badge tone={statusTone(request.status)}>{request.status}</Badge></div>
          <Link href={`/ilan/${listing.id}`} className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-forest hover:underline">{listing.title} · {listing.district}, {listing.city}<ChevronRight size={15} /></Link>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted"><span className="inline-flex items-center gap-2"><CalendarDays size={15} />{request.dates}</span><span>{request.people} kişi</span><span>{request.nights} gece</span></div>
          {request.reason ? <p className="mt-3 rounded-xl bg-error-soft px-3 py-2 text-xs leading-5 text-error">Red gerekçesi: {request.reason}</p> : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div><p className="text-xs text-ink-muted">Örnek toplam</p><p className="font-bold text-ink">{formatCurrency(total)}</p></div>
            {request.status === "Bekliyor" && tab === "incoming" ? <div className="flex gap-2"><Button size="sm" onClick={() => changeStatus(request.id, "Onaylandı")}><Check size={15} /> Onayla (demo)</Button><Button variant="outline" size="sm" onClick={() => { setRejectId(rejectId === request.id ? null : request.id); setFeedback(""); }}><X size={15} /> Reddet</Button></div> : request.status === "Bekliyor" && tab === "outgoing" ? <Button variant="outline" size="sm" onClick={() => changeStatus(request.id, "İptal edildi")}>Talebi iptal et</Button> : null}
          </div>
          {rejectId === request.id ? <div className="mt-4 grid gap-2 border-t border-line pt-4"><label htmlFor={`reason-${request.id}`} className="text-sm font-bold">Red gerekçesi</label><textarea id={`reason-${request.id}`} className="min-h-20 rounded-xl border border-line p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Kısa bir açıklama yaz" /><div className="flex justify-end"><Button size="sm" variant="destructive" onClick={() => rejectRequest(request.id)}>Demo reddini uygula</Button></div></div> : null}
          <p className="mt-3 text-xs text-ink-faint">Tarih ve fiyatlar örnektir. Bu eylem gerçek rezervasyon veya ödeme başlatmaz.</p>
        </article>;
      })}</div> : <div className="rounded-3xl border border-dashed border-line bg-white p-10 text-center"><h2 className="font-display text-lg font-bold">Bu sekmede örnek talep yok</h2><p className="mt-2 text-sm text-ink-muted">Yeni durumlar gerçek veriye kaydedilmez.</p></div>}
    </div>
  );
}
