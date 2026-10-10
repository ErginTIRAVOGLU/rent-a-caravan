import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, totalPages, query }: { page: number; totalPages: number; query: string }) {
  const hrefFor = (target: number) => `/arama?${query ? `${query}&` : ""}sayfa=${target}`;
  return (
    <nav aria-label="Sonuç sayfaları" className="mt-10 flex items-center justify-center gap-2">
      <Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0} className={`grid size-11 place-items-center rounded-full border border-line ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={hrefFor(Math.max(1, page - 1))} aria-label="Önceki sayfa"><ChevronLeft size={18} /></Link>
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={hrefFor(number)} aria-current={page === number ? "page" : undefined} className={`grid size-11 place-items-center rounded-full text-sm font-bold ${page === number ? "bg-forest text-white" : "border border-line bg-white text-ink hover:bg-paper"}`}>{number}</Link>)}
      <Link aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : 0} className={`grid size-11 place-items-center rounded-full border border-line ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-white"}`} href={hrefFor(Math.min(totalPages, page + 1))} aria-label="Sonraki sayfa"><ChevronRight size={18} /></Link>
    </nav>
  );
}
