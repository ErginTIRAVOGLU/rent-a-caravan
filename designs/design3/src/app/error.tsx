"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Karavan page error", error.digest); }, [error]);
  return <div className="page-container grid min-h-[55vh] place-items-center py-14"><div className="max-w-lg rounded-3xl border border-line bg-white p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-error-soft text-error"><AlertTriangle size={22} /></span><h1 className="mt-4 font-display text-2xl font-bold text-ink">Bir şeyler yolunda gitmedi.</h1><p className="mt-2 text-sm leading-6 text-ink-muted">Sayfayı yeniden yükleyebilir veya ana sayfaya dönebilirsin.</p><Button className="mt-5" onClick={() => reset()}><RotateCcw size={16} /> Yeniden dene</Button></div></div>;
}
