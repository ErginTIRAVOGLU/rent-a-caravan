// Kök yükleme iskeleti — kendine `loading.tsx` OLMAYAN tüm rotalarda görünür
// (App Router segment bazlı fallback'i). Statik, ek bağımlılık yok;
// animasyon Tailwind `animate-pulse`.

export default function Loading() {
  return (
    <main
      className="min-h-screen bg-gray-50"
      aria-busy="true"
      aria-label="Yükleniyor"
    >
      <span className="sr-only">Yükleniyor…</span>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-gray-200" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <div className="aspect-[4/3] w-full animate-pulse bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
