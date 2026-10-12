import type { ReactNode } from "react";
import Link from "next/link";

export type StatCardTone = "primary" | "accent" | "success" | "error" | "info";

type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Alt açıklama (ör. "geçen haftaya göre"). */
  hint?: string;
  icon: string;
  tone: StatCardTone;
  /** Verilirse kart tıklanabilir bir bağlantı olur. */
  href?: string;
};

const TONE_ICON: Record<StatCardTone, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent-soft text-accent-deep",
  success: "bg-success-bg text-success",
  error: "bg-error-bg text-error",
  info: "bg-info-bg text-info",
};

/** Özet istatistik kartı — ikon + etiket + büyük değer + ipucu. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
  href,
}: StatCardProps) {
  const body = (
    <div className="flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-label-lg text-on-surface-variant">{label}</p>
        <p className="mt-1 text-headline-lg font-bold text-on-surface">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-body-sm text-on-surface-variant">{hint}</p>
        ) : null}
      </div>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}
      >
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="card card-hover block">
        {body}
      </Link>
    );
  }

  return <div className="card">{body}</div>;
}
