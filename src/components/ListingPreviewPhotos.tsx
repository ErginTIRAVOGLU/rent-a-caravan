// Önizleme fotoğraf ızgarası — ListingForm 3. adım (önizleme) photoUrls'i
// sırasıyla gösterir; ilk fotoğraf "Kapak" rozeti taşır (kapak = photoUrls[0]).

export function ListingPreviewPhotos({
  photoUrls,
}: {
  photoUrls: string[];
}) {
  if (photoUrls.length === 0) {
    return (
      <p className="py-2 text-sm text-gray-500">Henüz fotoğraf eklenmedi.</p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photoUrls.map((url, index) => (
        <li
          key={url}
          className="relative overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`İlan fotoğrafı ${index + 1}`}
            className="h-24 w-full object-cover"
          />
          {index === 0 ? (
            <span className="absolute left-1 top-1 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
              Kapak
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
