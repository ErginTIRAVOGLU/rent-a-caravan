import type { Listing } from "@prisma/client";
import Link from "next/link";

import { VEHICLE_TYPE_LABELS } from "../lib/labels";
import { formatTRY } from "../lib/format";

// İlan kartı — sunucu bileşeni (state yok). `nightlyPrice` Prisma Decimal'dir;
// Number() ile SAYI olarak render edilir (Decimal objesi asla DOM'a gitmez).

type ListingCardProps = {
  listing: Listing;
  /** Arama seçili konaklama tarihleri — detay linkine taşınır (fiyat özeti). */
  stay?: { baslangic?: string; bitis?: string };
};

export function ListingCard({ listing, stay }: ListingCardProps) {
  const price = Number(listing.nightlyPrice);
  const params = new URLSearchParams();
  if (stay?.baslangic) params.set("baslangic", stay.baslangic);
  if (stay?.bitis) params.set("bitis", stay.bitis);
  const query = params.toString();
  const href = query
    ? `/ilan/${listing.id}?${query}`
    : `/ilan/${listing.id}`;

  const brandModel = [listing.brand, listing.model].filter(Boolean).join(" ");
  const subtitle =
    brandModel || VEHICLE_TYPE_LABELS[listing.vehicleType];
  const photo = listing.photoUrls[0];
  const location = [listing.city, listing.district]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group card card-hover overflow-hidden">
      <Link href={href} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-mid">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- UploadThing URL'leri next.config images domain listesinde değil; PhotoUploader da <img> kullanır.
            <img
              src={photo}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- yerel fallback
            <img
              src="/images/photo-fallback.svg"
              alt="Fotoğraf yok"
              className="h-full w-full object-cover opacity-70"
            />
          )}
          <span className="badge badge-primary absolute left-3 top-3 shadow-sm">
            {VEHICLE_TYPE_LABELS[listing.vehicleType]}
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate font-bold text-on-surface transition-colors group-hover:text-primary">
              {listing.title}
            </h3>
            <span className="shrink-0 text-body-sm text-on-surface-variant">
              {listing.capacity} kişi
            </span>
          </div>

          <p className="mt-1 flex min-w-0 items-center gap-1 text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined shrink-0 text-base text-accent">
              location_on
            </span>
            <span className="truncate">
              {location} · {subtitle}
            </span>
          </p>

          <div className="mt-3 flex items-center justify-between border-t border-outline-variant/60 pt-3">
            <p>
              <span className="text-price text-primary">{formatTRY(price)}</span>
              <span className="text-body-sm text-on-surface-variant"> / gece</span>
            </p>
            <span className="inline-flex items-center gap-1 text-label-lg text-accent-deep transition-all group-hover:gap-2">
              İncele
              <span className="material-symbols-outlined text-base">
                arrow_forward
              </span>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
