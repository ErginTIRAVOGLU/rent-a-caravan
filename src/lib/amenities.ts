// Amenities sabit katalog (spec §3.1) — DB'de kolon değil, sabit kod listesi.
// Yalnız burada tek tanım; arayüz etiketleri Türkçe, anahtarlar İngilizce.

export const AMENITIES = [
  { key: "AIR_CONDITIONING", label: "Klima" },
  { key: "WC", label: "WC" },
  { key: "SHOWER", label: "Duş" },
  { key: "SOLAR_PANEL", label: "Güneş Paneli" },
  { key: "AWNING", label: "Tente" },
  { key: "HEATING", label: "Isıtma" },
  { key: "TV", label: "TV" },
  { key: "HOT_WATER", label: "Sıcak Su" },
  { key: "STOVE", label: "Ocak" },
  { key: "FRIDGE", label: "Buzdolabı" },
  { key: "BEDDING", label: "Yatak Takımı" },
  { key: "COOKWARE", label: "Mutfak Takımı" },
  { key: "GPS", label: "GPS" },
  { key: "BIKE_RACK", label: "Bisiklet Taşıyıcı" },
  { key: "REAR_CAMERA", label: "Kamera" },
  { key: "INVERTER", label: "İnvertör" },
  { key: "WIFI", label: "WiFi" },
] as const satisfies ReadonlyArray<{ key: string; label: string }>;

/** Katalog anahtarının tipi — şema ve form bu tipi kullanır. */
export type AmenityKey = (typeof AMENITIES)[number]["key"];

/** Zod enum / arama filtreleri için düz anahtar listesi (17 kayıt). */
export const AMENITY_KEYS: readonly AmenityKey[] = AMENITIES.map((a) => a.key);
