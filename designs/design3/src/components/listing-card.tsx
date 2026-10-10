import Link from "next/link";
import { ArrowUpRight, BedDouble, UsersRound } from "lucide-react";
import type { Listing } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { SiteImage } from "@/components/site-image";

export function ListingCard({ listing, compact = false, searchQuery = "" }: { listing: Listing; compact?: boolean; searchQuery?: string }) {
  return (
    <article className="group min-w-0">
      <Link href={`/ilan/${listing.id}${searchQuery ? `?${searchQuery}` : ""}`} className="block rounded-[1.4rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-4">
        <div className={`relative overflow-hidden rounded-[1.4rem] bg-sage-pale ${compact ? "aspect-[1.2/1]" : "aspect-[1.13/1]"}`}>
          <SiteImage src={listing.image} alt={`${listing.title} adlı örnek karavan ilanının fotoğrafı`} fill unoptimized sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, 27vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
          <span className="absolute left-3 top-3"><Badge tone="neutral">Örnek ilan</Badge></span>
          <span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-white/95 text-forest shadow-soft transition-transform group-hover:translate-x-0.5" aria-hidden="true"><ArrowUpRight size={16} /></span>
        </div>
        <div className="pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate font-display text-base font-bold text-ink group-hover:text-forest">{listing.title}</h3><p className="mt-1 text-sm text-ink-muted">{listing.district}, {listing.city}</p></div>
            <span className="whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-deep">{listing.highlight}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted"><span className="inline-flex items-center gap-1.5"><UsersRound size={15} /> {listing.capacity} kişi</span><span className="inline-flex items-center gap-1.5"><BedDouble size={15} /> {listing.beds} yatak</span><span>{listing.vehicleType}</span></div>
          <p className="mt-3 border-t border-line pt-3 text-sm text-ink"><strong className="font-extrabold">{formatCurrency(listing.nightlyPrice)}</strong><span className="text-ink-muted"> / gece</span></p>
        </div>
      </Link>
    </article>
  );
}
