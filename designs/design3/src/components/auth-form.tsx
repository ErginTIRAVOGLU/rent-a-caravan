"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button, Field, inputClass } from "@/components/ui";

const emailRule = z.string().trim().email("Geçerli bir e-posta adresi yaz.");
const passwordRule = z.string().min(8, "Şifre en az 8 karakter olmalı.");

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const register = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [notice, setNotice] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schema = register
      ? z.object({ name: z.string().trim().min(2, "Ad en az 2 karakter olmalı."), email: emailRule, password: passwordRule })
      : z.object({ email: emailRule, password: passwordRule });
    const parsed = schema.safeParse(register ? { name, email, password } : { email, password });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setNotice("");
      return;
    }
    setErrors({});
    setNotice(register ? "Bilgiler kontrol edildi. Demo sürümünde hesap oluşturulmadı." : "Bilgiler kontrol edildi. Demo sürümünde giriş yapılmadı.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {register ? <Field label="Ad soyad" error={errors.name}><span className="relative"><UserRound size={17} className="absolute left-3.5 top-3.5 text-ink-faint" /><input className={`${inputClass} pl-10`} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Adın ve soyadın" /></span></Field> : null}
      <Field label="E-posta" error={errors.email}><span className="relative"><Mail size={17} className="absolute left-3.5 top-3.5 text-ink-faint" /><input className={`${inputClass} pl-10`} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@eposta.com" /></span></Field>
      <Field label="Şifre" error={errors.password}><span className="relative"><LockKeyhole size={17} className="absolute left-3.5 top-3.5 text-ink-faint" /><input className={`${inputClass} pl-10 pr-12`} type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="En az 8 karakter" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-0 grid size-11 place-items-center rounded-full text-ink-muted hover:bg-paper" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></Field>
      {register ? <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-muted"><input className="mt-1 size-4 accent-forest" type="checkbox" required /><span>Demo formunda bilgilerin gönderilmediğini anladım.</span></label> : null}
      <Button type="submit" size="lg" className="mt-1 w-full">{register ? "Hesap oluştur" : "Giriş yap"} <ArrowRight size={17} /></Button>
      {notice ? <p className="rounded-xl border border-info/20 bg-info-soft px-3.5 py-3 text-sm leading-5 text-info" role="status">{notice} Herhangi bir bilgi sunucuya gönderilmedi.</p> : null}
      <p className="text-center text-sm text-ink-muted">{register ? "Zaten hesabın var mı?" : "Karavan yolculuğuna yeni misin?"} <Link className="font-bold text-forest underline underline-offset-4" href={register ? "/giris" : "/kayit"}>{register ? "Giriş yap" : "Hesap oluştur"}</Link></p>
    </form>
  );
}
