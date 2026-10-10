export default function Loading() {
  return <div className="page-container animate-pulse py-10" aria-label="Sayfa yükleniyor" aria-busy="true"><div className="mb-6 h-8 max-w-xs rounded-xl bg-neutral-soft" /><div className="h-5 max-w-lg rounded-lg bg-neutral-soft" /><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="aspect-[4/3] rounded-3xl bg-neutral-soft" /><div className="aspect-[4/3] rounded-3xl bg-neutral-soft" /><div className="hidden aspect-[4/3] rounded-3xl bg-neutral-soft lg:block" /></div></div>;
}
