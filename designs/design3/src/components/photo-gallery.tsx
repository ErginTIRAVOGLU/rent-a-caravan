"use client";

import { useState } from "react";
import { Images } from "lucide-react";
import { SiteImage } from "@/components/site-image";

export function PhotoGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const safeImages = images.length ? images : ["/images/photo-fallback.svg"];
  return (
    <section aria-label={`${title} fotoğraf galerisi`}>
      <div className="grid gap-3 md:grid-cols-[1.55fr_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-sage-pale md:aspect-[1.15/1]">
          <SiteImage src={safeImages[active] ?? safeImages[0]} alt={`${title} — seçili fotoğraf ${active + 1}`} fill unoptimized priority sizes="(max-width: 768px) 100vw, 60vw" className="object-cover" />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-ink"><Images size={15} /> {active + 1} / {safeImages.length} · Demo fotoğraflar</span>
        </div>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-2 md:grid-rows-2">
          {safeImages.slice(1, 5).map((src, index) => (
            <button type="button" key={src} onClick={() => setActive(index + 1)} aria-label={`${title} fotoğraf ${index + 2} görüntüle`} aria-pressed={active === index + 1} className={`relative min-h-24 overflow-hidden rounded-2xl bg-sage-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest md:min-h-0 ${active === index + 1 ? "ring-2 ring-forest ring-offset-2" : ""}`}>
              <SiteImage src={src} alt={`${title} galeri önizlemesi ${index + 2}`} fill unoptimized sizes="(max-width: 768px) 30vw, 24vw" className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
