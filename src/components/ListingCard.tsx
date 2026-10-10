import type { Listing } from "@prisma/client";
import Link from "next/link";

import { VEHICLE_TYPE_LABELS } from "../lib/labels";

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
    <li className="overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md">
      <Link href={href} className="block">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- UploadThing URL'leri next.config images domain listesinde değil; PhotoUploader da <img> kullanır.
          <img
            src={photo}
            alt={listing.title}
            className="aspect-[4/3] w-full bg-gray-100 object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
            Fotoğraf yok
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-gray-900">
              {listing.title}
            </h3>
            <span className="shrink-0 text-xs text-gray-500">
              {listing.capacity} kişi
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-gray-600">
            {location} · {subtitle}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-bold text-gray-900">{price} ₺</span>
            <span className="text-gray-500"> / gece</span>
          </p>
        </div>
      </Link>
    </li>
  );
}
