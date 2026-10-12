import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: string;
  title: string;
  description?: string;
  /** Tek net CTA. */
  action?: ReactNode;
};

/** Boş durum — ikon + başlık + açıklama + tek CTA. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-low text-outline">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </span>
      <p className="mt-4 text-title-md font-semibold text-on-surface">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-body-md text-on-surface-variant">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
