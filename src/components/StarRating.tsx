"use client";

import { useState } from "react";

// StarRating — SVG yıldız bileşeni. İki mod:
//   - Display-only (varsayılan): salt okunur, yıldızlar SVG span.
//   - Interactive (onChange verilirse): tıklanabilir butonlar + hover önizleme.
// Form'da kullanırken `onChange` ile rating state'ini bağlayın.

type Props = {
  /** Mevcut puan (1-5). */
  value: number;
  /** Verilirse yıldızlar tıklanabilir olur. */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function StarRating({ value, onChange, size = "md", label }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const interactive = onChange !== undefined;
  const displayValue = hovered ?? value;

  return (
    <div
      className="flex items-center gap-1"
      role={interactive ? "radiogroup" : undefined}
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        const starSvg = (
          <svg
            viewBox="0 0 24 24"
            className={`${sizeClasses[size]} ${filled ? "text-accent" : "text-outline"}`}
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={filled ? 0 : 1.5}
            aria-hidden="true"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );

        if (!interactive) {
          return (
            <span key={star} className="inline-flex">
              {starSvg}
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            aria-label={`${star} yıldız`}
            className="focus:outline-none"
          >
            {starSvg}
          </button>
        );
      })}
    </div>
  );
}
