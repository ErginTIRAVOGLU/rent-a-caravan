import { CalendarDays, MapPin, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui";

type SearchFormProps = { variant?: "hero" | "compact"; values?: { city?: string; startDate?: string; endDate?: string; persons?: string } };

export function SearchForm({ variant = "hero", values }: SearchFormProps) {
  return (
    <form action="/arama" method="get" className={`grid gap-1 rounded-[1.5rem] border border-line bg-white p-2 shadow-lift ${variant === "hero" ? "sm:grid-cols-[1.25fr_1fr_1fr_0.85fr_auto]" : "md:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto]"}`}>
      <label className="flex min-h-14 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-paper focus-within:bg-paper">
        <MapPin size={19} className="shrink-0 text-forest" aria-hidden="true" />
        <span className="grid min-w-0 flex-1"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Nereye?</span><input className="min-w-0 border-0 bg-transparent text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint" name="sehir" placeholder="Şehir veya bölge" aria-label="Şehir veya bölge" defaultValue={values?.city} /></span>
      </label>
      <label className="flex min-h-14 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-paper focus-within:bg-paper">
        <CalendarDays size={18} className="shrink-0 text-forest" aria-hidden="true" />
        <span className="grid min-w-0 flex-1"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Başlangıç</span><input className="min-w-0 border-0 bg-transparent text-sm font-semibold text-ink outline-none" type="date" name="baslangic" aria-label="Giriş tarihi" defaultValue={values?.startDate} /></span>
      </label>
      <label className="flex min-h-14 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-paper focus-within:bg-paper">
        <CalendarDays size={18} className="shrink-0 text-forest" aria-hidden="true" />
        <span className="grid min-w-0 flex-1"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Bitiş</span><input className="min-w-0 border-0 bg-transparent text-sm font-semibold text-ink outline-none" type="date" name="bitis" aria-label="Çıkış tarihi" defaultValue={values?.endDate} /></span>
      </label>
      <label className="flex min-h-14 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-paper focus-within:bg-paper">
        <UsersRound size={18} className="shrink-0 text-forest" aria-hidden="true" />
        <span className="grid min-w-0 flex-1"><span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Kişi</span><select className="min-w-0 border-0 bg-transparent text-sm font-semibold text-ink outline-none" name="kisi" defaultValue={values?.persons ?? ""}><option value="">Herkes</option>{[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} kişi</option>)}</select></span>
      </label>
      <Button type="submit" size={variant === "hero" ? "lg" : "md"} aria-label="Karavan bul" className="min-h-14 rounded-2xl px-6"><Search size={18} /> <span className="sm:hidden lg:inline">Karavan bul</span></Button>
    </form>
  );
}
