export type VehicleType = "Motokaravan" | "Campervan" | "Çekme karavan";

export type Listing = {
  id: string;
  title: string;
  city: string;
  district: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year: number;
  transmission: string;
  fuel: string;
  capacity: number;
  beds: number;
  dimensions: string;
  nightlyPrice: number;
  license: string;
  minimumDriverAge: number;
  minimumNights: number;
  hostName: string;
  hostInitials: string;
  description: string;
  highlight: string;
  image: string;
  gallery: string[];
  amenities: string[];
  rules: string[];
  demo: true;
};

const image = {
  hero: "/manus-storage/async-images/8kcjvfQQz0kFwZzIaeFyYE/image-1.webp",
  aegean: "/manus-storage/async-images/8kcjvfQQz0kFwZzIaeFyYE/image-2.webp",
  forest: "/manus-storage/async-images/8kcjvfQQz0kFwZzIaeFyYE/image-3.webp",
  highlands: "/manus-storage/async-images/8kcjvfQQz0kFwZzIaeFyYE/image-4.webp",
  anatolia: "/manus-storage/async-images/8kcjvfQQz0kFwZzIaeFyYE/image-5.webp",
  interior: "/manus-storage/async-images/CaRs7W7a2GhRCNM3JoB2Nj/image-1.webp",
  kitchen: "/manus-storage/async-images/CaRs7W7a2GhRCNM3JoB2Nj/image-2.webp",
  sleeping: "/manus-storage/async-images/CaRs7W7a2GhRCNM3JoB2Nj/image-3.webp",
};

const standardAmenities = [
  "Güneş paneli",
  "Tente",
  "Isıtma",
  "Ocak",
  "Buzdolabı",
  "Mutfak takımı",
  "Yatak takımı",
  "GPS",
  "WiFi",
];

export const demoListings: Listing[] = [
  {
    id: "ege-rotasi",
    title: "Ege Rotası",
    city: "İzmir",
    district: "Urla",
    vehicleType: "Campervan",
    brand: "Özel yapım",
    model: "Uzun şasi dönüşüm",
    year: 2023,
    transmission: "Manuel",
    fuel: "Dizel",
    capacity: 4,
    beds: 2,
    dimensions: "5,6 × 2,1 m",
    nightlyPrice: 4200,
    license: "B sınıfı",
    minimumDriverAge: 25,
    minimumNights: 2,
    hostName: "Deniz Yılmaz",
    hostInitials: "DY",
    description:
      "Kıyı yollarında küçük molalar ve uzun hafta sonları için düşünülmüş, aydınlık ve düzenli bir yol arkadaşı. Bu ilan ve içerik örnek amaçlıdır.",
    highlight: "Kıyı yollarına hazır",
    image: image.aegean,
    gallery: [image.aegean, image.interior, image.kitchen, image.sleeping],
    amenities: [
      ...standardAmenities,
      "Klima",
      "WC",
      "Sıcak su",
      "Kamera",
      "İnvertör",
      "Bisiklet taşıyıcı",
    ],
    rules: [
      "Araç tesliminde temel kullanım bilgileri paylaşılır.",
      "Araç içinde sigara içilmez.",
      "Evcil hayvan için talep öncesinde bilgi alınır.",
    ],
    demo: true,
  },
  {
    id: "orman-yuvasi",
    title: "Orman Yuvası",
    city: "Muğla",
    district: "Köyceğiz",
    vehicleType: "Campervan",
    brand: "Özel yapım",
    model: "Kompakt pop-top",
    year: 2022,
    transmission: "Manuel",
    fuel: "Dizel",
    capacity: 3,
    beds: 2,
    dimensions: "5,1 × 2,0 m",
    nightlyPrice: 3650,
    license: "B sınıfı",
    minimumDriverAge: 24,
    minimumNights: 2,
    hostName: "Ece Arslan",
    hostInitials: "EA",
    description:
      "Göl ve çam kokulu patikalar arasında, kolay park edilen sade bir campervan. Bu ilan ve içerik örnek amaçlıdır.",
    highlight: "Kompakt ve kullanışlı",
    image: image.forest,
    gallery: [image.forest, image.interior, image.kitchen, image.sleeping],
    amenities: ["Tente", "Isıtma", "Ocak", "Buzdolabı", "Mutfak takımı", "GPS", "WiFi"],
    rules: [
      "Teslim ve iade saatleri talep onayında birlikte netleştirilir.",
      "Araç içinde sigara içilmez.",
    ],
    demo: true,
  },
  {
    id: "yayla-konforu",
    title: "Yayla Konforu",
    city: "Rize",
    district: "Çamlıhemşin",
    vehicleType: "Motokaravan",
    brand: "Özel yapım",
    model: "Aile motokaravanı",
    year: 2021,
    transmission: "Manuel",
    fuel: "Dizel",
    capacity: 5,
    beds: 4,
    dimensions: "6,4 × 2,3 m",
    nightlyPrice: 5100,
    license: "B sınıfı",
    minimumDriverAge: 26,
    minimumNights: 3,
    hostName: "Mert Kaya",
    hostInitials: "MK",
    description:
      "Daha geniş yaşam alanı arayanlar için ferah bir aile motokaravanı. Bu ilan ve içerik örnek amaçlıdır.",
    highlight: "Aile gezileri için",
    image: image.highlands,
    gallery: [image.highlands, image.interior, image.kitchen, image.sleeping],
    amenities: [...standardAmenities, "Duş", "WC", "Sıcak su", "TV", "Klima"],
    rules: [
      "Aracı yalnızca ilanda belirtilen yaş ve ehliyet koşullarını sağlayan sürücüler kullanabilir.",
      "Teslimde araç durumu birlikte kontrol edilir.",
    ],
    demo: true,
  },
  {
    id: "kapadokya-yolu",
    title: "Kapadokya Yolu",
    city: "Nevşehir",
    district: "Ürgüp",
    vehicleType: "Motokaravan",
    brand: "Özel yapım",
    model: "Yarı entegre",
    year: 2024,
    transmission: "Otomatik",
    fuel: "Dizel",
    capacity: 4,
    beds: 3,
    dimensions: "6,0 × 2,2 m",
    nightlyPrice: 4750,
    license: "B sınıfı",
    minimumDriverAge: 25,
    minimumNights: 2,
    hostName: "Selin Demir",
    hostInitials: "SD",
    description:
      "İç Anadolu rotalarına çıkmak isteyenler için gün ışığı alan, düzenli bir yaşam alanı. Bu ilan ve içerik örnek amaçlıdır.",
    highlight: "Uzun rotalara uygun",
    image: image.anatolia,
    gallery: [image.anatolia, image.interior, image.kitchen, image.sleeping],
    amenities: [...standardAmenities, "Duş", "WC", "Güneş paneli", "İnvertör", "Kamera"],
    rules: [
      "Minimum kiralama süresi iki gecedir.",
      "Araç tesliminde yakıt seviyesi birlikte kaydedilir.",
    ],
    demo: true,
  },
];

export const equipmentCatalog = [
  "Klima",
  "WC",
  "Duş",
  "Güneş paneli",
  "Tente",
  "Isıtma",
  "TV",
  "Sıcak su",
  "Ocak",
  "Buzdolabı",
  "Yatak takımı",
  "Mutfak takımı",
  "GPS",
  "Bisiklet taşıyıcı",
  "Kamera",
  "İnvertör",
  "WiFi",
];

export const requestStatuses = ["Bekliyor", "Onaylandı", "Reddedildi", "İptal edildi", "Tamamlandı"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export type DemoDateRange = { start: string; end: string };
const demoUnavailableRanges: Record<string, DemoDateRange[]> = {
  "ege-rotasi": [{ start: "2026-10-20", end: "2026-10-22" }],
  "orman-yuvasi": [{ start: "2026-11-02", end: "2026-11-04" }],
  "yayla-konforu": [{ start: "2026-12-08", end: "2026-12-11" }],
  "kapadokya-yolu": [],
};

export function hasDemoDateConflict(listingId: string, start: string, end: string): boolean {
  if (!start || !end || start >= end) return false;
  return (demoUnavailableRanges[listingId] ?? []).some((range) => start < range.end && end > range.start);
}
