import type { ReactNode } from "react";

type PanelCardProps = {
  title: string;
  /** Başlık hizasındaki aksiyon (ör. "Tümünü gör"). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Başlıklı içerik kartı — panel bölümleri için ortak yüzey. */
export function PanelCard({
  title,
  action,
  children,
  className,
}: PanelCardProps) {
  return (
    <section className={`card ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/60 px-5 py-4">
        <h2 className="text-title-md font-semibold text-on-surface">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
