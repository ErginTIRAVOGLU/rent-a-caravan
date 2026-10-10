import type { Fuel, Transmission, VehicleType } from "@prisma/client";

// Arayüz etiketleri Türkçe, DB enum değerleri İngilizce — tek kaynak.
// ListingCard / SearchFilters / ilan detay bu haritaları paylaşır.

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TOWED_CARAVAN: "Çekme Karavan",
  PANELVAN: "Panelvan",
  MOTORHOME: "Motorkaravan",
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  MANUAL: "Manuel",
  SEMI_AUTOMATIC: "Yarı Otomatik",
  AUTOMATIC: "Otomatik",
};

export const FUEL_LABELS: Record<Fuel, string> = {
  DIESEL: "Dizel",
  PETROL: "Benzin",
  ELECTRIC: "Elektrik",
  HYBRID: "Hibrit",
};

/** Araç tipi seçeneği listesi (arama filtresi select'i). */
export const VEHICLE_TYPE_OPTIONS: ReadonlyArray<{
  value: VehicleType;
  label: string;
}> = (
  Object.entries(VEHICLE_TYPE_LABELS) as Array<[VehicleType, string]>
).map(([value, label]) => ({ value, label }));
