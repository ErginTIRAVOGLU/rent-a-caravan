"use client";

import { useState } from "react";

// Fotoğraf galerisi — ana görsel + küçük resim seçimi (istemci state'i).
// photoUrls boşsa yer tutucu gösterilir; <img> bilinçli (UploadThing URL'leri
// next.config images domain listesinde değil — PhotoUploader ile aynı yaklaşım).

export function PhotoGallery({
  photoUrls,
  title,
}: {
  photoUrls: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  if (photoUrls.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-mid">
        {/* eslint-disable-next-line @next/next/no-img-element -- yerel fallback */}
        <img
          src="/images/photo-fallback.svg"
          alt="Fotoğraf yok"
          className="h-24 w-auto opacity-60"
        />
      </div>
    );
  }

  const current = photoUrls[Math.min(active, photoUrls.length - 1)]!;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-mid">
        {/* eslint-disable-next-line @next/next/no-img-element -- uzak URL; bkz. başlık yorumu */}
        <img
          src={current}
          alt={`${title} — fotoğraf ${Math.min(active, photoUrls.length - 1) + 1}`}
          className="aspect-[16/9] w-full object-cover"
        />
      </div>
      {photoUrls.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photoUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Fotoğraf ${index + 1}`}
              aria-current={index === active}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${
                index === active
                  ? "border-primary"
                  : "border-transparent opacity-75 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- bkz. başlık yorumu */}
              <img
                src={url}
                alt=""
                className="h-16 w-24 bg-surface-mid object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
