"use client";

import { useState } from "react";
import { z } from "zod";
import { Button, Field, inputClass } from "@/components/ui";

const profileSchema = z.object({ name: z.string().trim().min(2, "Ad en az 2 karakter olmalı."), phone: z.string().trim().refine((value) => value.length === 0 || value.replace(/\D/g, "").length >= 10, "Telefon numaranı kontrol et."), email: z.string().trim().email("Geçerli bir e-posta yaz."), password: z.string().refine((value) => value.length === 0 || value.length >= 8, "Şifre en az 8 karakter olmalı.") });

export function ProfileForm() {
  const [name, setName] = useState("Demo Kullanıcı");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("ornek@karavan.demo");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileSchema.safeParse({ name, phone, email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) { const key = String(issue.path[0] ?? ""); if (key && !next[key]) next[key] = issue.message; }
      setErrors(next); setNotice(""); return;
    }
    setErrors({}); setNotice("Bilgiler kontrol edildi; demo sürümünde profil veya şifre kaydedilmedi."); setPassword("");
  }
  return <form onSubmit={submit} className="grid gap-5 rounded-3xl border border-line bg-white p-5 sm:p-7" noValidate>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Ad soyad" error={errors.name}><input className={inputClass} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Telefon" hint="Örnek arayüzde isteğe bağlı" error={errors.phone}><input className={inputClass} type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="05xx xxx xx xx" /></Field><div className="sm:col-span-2"><Field label="E-posta" error={errors.email}><input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field></div></div>
    <div className="border-t border-line pt-5"><h2 className="font-display text-lg font-bold">Şifre</h2><p className="mb-4 mt-1 text-sm text-ink-muted">Demo sürümünde şifre değiştirme işlemi bağlı değildir.</p><Field label="Yeni şifre" hint="En az 8 karakter" error={errors.password}><input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: "" })); }} placeholder="Yeni şifre" /></Field></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-muted">Bu sayfa örnek profil verisi kullanır.</p><Button type="submit">Değişiklikleri kontrol et</Button></div>
    {notice ? <p className="rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info" role="status">{notice}</p> : null}
  </form>;
}
