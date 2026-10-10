export default function SearchLoading() {
  return <div className="page-container animate-pulse py-10" aria-label="Arama sonuçları yükleniyor" aria-busy="true"><div className="mb-7 h-10 max-w-sm rounded-xl bg-neutral-soft" /><div className="h-20 rounded-3xl bg-neutral-soft" /><div className="mt-8 grid gap-7 lg:grid-cols-[250px_1fr]"><div className="hidden h-80 rounded-3xl bg-neutral-soft lg:block" /><div className="grid gap-5 sm:grid-cols-2"><div className="aspect-[1.13/1] rounded-3xl bg-neutral-soft" /><div className="aspect-[1.13/1] rounded-3xl bg-neutral-soft" /></div></div></div>;
}
