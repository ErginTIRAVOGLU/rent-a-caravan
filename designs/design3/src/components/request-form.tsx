"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { CalendarDays, UsersRound } from "lucide-react";
import { hasDemoDateConflict, type Listing } from "@/lib/demo-data";
import { formatCurrency, rentalDays } from "@/lib/utils";
import { Button, Field, inputClass } from "@/components/ui";

const requestSchema = z.object({
  start: z.string().min(1, "Giriş tarihini seç."),
  end: z.string().min(1, "Çıkış tarihini seç."),
  persons: z.coerce.number().int().min(1, "En az 1 kişi seç.").max(10, "En fazla 10 kişi seç."),
  message: z.string().trim().max(500, "Mesaj en fazla 500 karakter olabilir."),
}).refine((value) => value.start < value.end, { path: ["end"], message: "Çıkış tarihi girişten sonra olmalı." });

type Errors = Partial<Record<"start" | "end" | "persons" | "message", string>>;

export function RequestForm({ listing, initialStart = "", initialEnd = "", initialPersons = "2" }: { listing: Listing; initialStart?: string; initialEnd?: string; initialPersons?: string }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [persons, setPersons] = useState(String(Math.min(listing.capacity, Math.max(1, Number(initialPersons) || 2))));
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState("");
  const days = useMemo(() => start && end && start < end ? rentalDays(start, end) : 0, [start, end]);
  const total = days * listing.nightlyPrice;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = requestSchema.safeParse({ start, end, persons, message });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setNotice("");
      return;
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (parsed.data.start < today) {
      setErrors({ start: "Geçmiş bir giriş tarihi seçilemez." });
      setNotice("");
      return;
    }
    const nights = rentalDays(parsed.data.start, parsed.data.end);
    if (nights < listing.minimumNights) {
      setErrors({ end: `Bu ilan için en az ${listing.minimumNights} gece seçmelisin.` });
      setNotice("");
      return;
    }
    if (hasDemoDateConflict(listing.id, parsed.data.start, parsed.data.end)) {
      setErrors({ end: "Bu tarihler örnek araç uygunluk takviminde dolu görünüyor. Başka tarih seç." });
      setNotice("");
      return;
    }
    setErrors({});
    setNotice("Bilgiler kontrol edildi. Bu demo sürümünde talep sunucuya gönderilmedi ve tarih ayrılmadı.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Giriş" error={errors.start}><span className="relative"><CalendarDays className="absolute left-3 top-3.5 text-ink-muted" size={16} aria-hidden="true" /><input className={`${inputClass} pl-9`} type="date" value={start} onChange={(event) => setStart(event.target.value)} aria-label="Giriş tarihi" /></span></Field>
        <Field label="Çıkış" error={errors.end}><span className="relative"><CalendarDays className="absolute left-3 top-3.5 text-ink-muted" size={16} aria-hidden="true" /><input className={`${inputClass} pl-9`} type="date" value={end} onChange={(event) => setEnd(event.target.value)} aria-label="Çıkış tarihi" /></span></Field>
      </div>
      <Field label="Kişi sayısı" error={errors.persons}><span className="relative"><UsersRound className="absolute left-3 top-3.5 text-ink-muted" size={16} aria-hidden="true" /><select className={`${inputClass} pl-9`} value={persons} onChange={(event) => setPersons(event.target.value)}>{Array.from({ length: listing.capacity }, (_, index) => index + 1).map((num) => <option key={num} value={num}>{num} kişi</option>)}</select></span></Field>
      <Field label="Ev sahibine not" hint="İsteğe bağlı · En fazla 500 karakter" error={errors.message}><textarea className={`${inputClass} min-h-24 resize-y py-3`} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Rotan veya soruların hakkında kısa bir not yaz…" /></Field>
      <div className="border-t border-line pt-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="text-ink-muted">{days ? `${formatCurrency(listing.nightlyPrice)} × ${days} gece` : `${formatCurrency(listing.nightlyPrice)} / gece`}</span><span className="text-right font-bold text-ink">{days ? formatCurrency(total) : "Tarih seçilince hesaplanır"}</span></div><p className="mt-1 text-xs text-ink-muted">Örnek toplam · ek ücret veya ödeme alınmaz</p><div className="mt-4"><Button type="submit" className="w-full">Talep bilgilerini kontrol et</Button></div></div>
      <p className="text-xs leading-5 text-ink-muted">Bu bir kiralama talebi taslağıdır; rezervasyon veya ödeme değildir.</p>
      {notice ? <p className="rounded-xl border border-info/20 bg-info-soft px-3.5 py-3 text-sm leading-5 text-info" role="status">{notice}</p> : null}
    </form>
  );
}
