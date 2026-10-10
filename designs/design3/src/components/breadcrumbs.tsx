import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return <nav aria-label="İzlek" className="mb-5"><ol className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">{items.map((item, index) => {
    const current = index === items.length - 1;
    return <li key={`${item.label}-${index}`} className="flex items-center gap-2">{index > 0 ? <span aria-hidden="true" className="text-ink-faint">/</span> : null}{item.href && !current ? <Link className="rounded-sm hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest" href={item.href}>{item.label}</Link> : <span aria-current={current ? "page" : undefined} className={current ? "text-ink" : ""}>{item.label}</span>}</li>;
  })}</ol></nav>;
}
