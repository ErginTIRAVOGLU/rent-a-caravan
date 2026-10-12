import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Sağdaki ana aksiyon(lar). */
  actions?: ReactNode;
};

/** Sayfa başlığı: eyebrow + başlık + açıklama + sağda aksiyonlar. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="section-title mt-1">{title}</h1>
        {description ? (
          <p className="mt-1 text-body-md text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
