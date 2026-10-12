"use client";

import { useState } from "react";

/**
 * İlan galerisi: ana görsel + seçilebilir küçük resimler.
 *
 * Neden istemci bileşeni: küçük resme tıklamak ana görseli değiştirir (seçim
 * durumu tutulur). Daha önce küçük resimler işleyicisiz butonlardı ve ana
 * görsel her zaman `photoUrls[0]` idi — tıklamak hiçbir şey yapmıyordu.
 */
export function ListingGallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const [selected, setSelected] = useState(0);
  // Fotoğraflar değişirse (başka ilana geçiş) seçili indeks aralık dışı kalabilir.
  const current = photos[selected] ?? photos[0];

  return (
    <div className="space-y-3">
      {/* Ana görsel */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-surface-low">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- UploadThing URL'leri next.config images domain listesinde değil; bkz. ListingCard
          <img
            src={current}
            alt={`${title} - Ana görsel`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-mid">
            <span className="material-symbols-outlined text-4xl text-outline">
              photo_camera
            </span>
          </div>
        )}
      </div>

      {/* Küçük resimler (thumbnail strip) */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
          {photos.map((url, index) => {
            const active = index === selected;
            return (
              <button
                key={url}
                type="button"
                onClick={() => setSelected(index)}
                aria-label={`Fotoğraf ${index + 1}`}
                aria-current={active ? "true" : undefined}
                className={`relative h-20 w-28 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  active ? "border-accent" : "border-transparent hover:border-accent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- bkz. yukarıdaki galeri yorumu */}
                <img
                  src={url}
                  alt={`${title} - Fotoğraf ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
