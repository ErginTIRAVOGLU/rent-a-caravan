import { prisma } from "../lib/prisma";
import { ListingCard } from "../components/ListingCard";
import { SearchFilters } from "../components/SearchFilters";

// Genel ana sayfa: arama kutusu (/arama'ya gider) + son eklenen 12 aktif ilan.

// Liste canlı veri: statik prerender build anındaki ilanları dondururdu.
export const dynamic = "force-dynamic";

export default async function Home() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero + arama kutusu */}
      <section className="bg-emerald-700 px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Karavanınız sizi bekliyor
          </h1>
          <p className="mt-2 max-w-2xl text-emerald-50">
            Türkiye genelindeki karavanlar arasından tarihinize ve
            bütçenize uygun olanı bulun, doğrudan sahibiyle iletişime geçin.
          </p>
          <div className="mt-6 rounded-2xl bg-white p-4 shadow-lg sm:p-5">
            <SearchFilters />
          </div>
        </div>
      </section>

      {/* Son eklenen aktif ilanlar */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <h2 className="text-xl font-bold text-gray-900">
          Son eklenen ilanlar
        </h2>
        {listings.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">
              Şu anda yayında ilan bulunmuyor. İlk ilanı siz oluşturun.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
