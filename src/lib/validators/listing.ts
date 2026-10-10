import { z } from "zod";

import { AMENITIES, AMENITY_KEYS } from "../amenities";

// İlan giriş şeması — tek doğrulama kaynağı (form + service aynı şemayı kullanır).
// Enum değerleri DB ile aynı İngilizce kodlar; hata mesajları Türkçe.
// NOT: id/ownerId/createdAt/rejectionReason istemci alanıdır — şemaya alınmaz;
// status yalnız sunucu tarafından yazılır, şemadaki hali istemce "yok sayılır".

/** Bir ilana en fazla eklenebilecek fotoğraf sayısı (T7 yükleyicisi de bunu kullanır). */
export const MAX_PHOTOS = 10;

const vehicleTypeField = z.enum(
  ["TOWED_CARAVAN", "PANELVAN", "MOTORHOME"],
  "Geçerli bir araç tipi seçin.",
);
const transmissionField = z.enum(
  ["MANUAL", "SEMI_AUTOMATIC", "AUTOMATIC"],
  "Geçerli bir vites tipi seçin.",
);
const fuelField = z.enum(
  ["DIESEL", "PETROL", "ELECTRIC", "HYBRID"],
  "Geçerli bir yakıt tipi seçin.",
);
const licenseRequiredField = z.enum(
  ["B", "BE", "C1", "C"],
  "Geçerli bir ehliyet sınıfı seçin.",
);

export const listingSchema = z.object({
  title: z
    .string("İlan başlığı zorunludur.")
    .trim()
    .min(10, "İlan başlığı en az 10 karakter olmalıdır.")
    .max(120, "İlan başlığı en fazla 120 karakter olabilir."),
  description: z
    .string("İlan açıklaması zorunludur.")
    .trim()
    .min(20, "İlan açıklaması en az 20 karakter olmalıdır.")
    .max(5000, "İlan açıklaması en fazla 5000 karakter olabilir."),
  city: z
    .string("Şehir zorunludur.")
    .trim()
    .min(2, "Şehir adı en az 2 karakter olmalıdır.")
    .max(80, "Şehir adı en fazla 80 karakter olabilir."),
  district: z.string().trim().max(80, "İlçe adı en fazla 80 karakter olabilir.").nullish(),
  lat: z
    .number("Enlem sayısal olmalıdır.")
    .min(-90, "Enlem -90 ile 90 arasında olmalıdır.")
    .max(90, "Enlem -90 ile 90 arasında olmalıdır.")
    .nullish(),
  lng: z
    .number("Boylam sayısal olmalıdır.")
    .min(-180, "Boylam -180 ile 180 arasında olmalıdır.")
    .max(180, "Boylam -180 ile 180 arasında olmalıdır.")
    .nullish(),
  nightlyPrice: z
    .number("Gece fiyatı sayısal olmalıdır.")
    .gt(0, "Gece fiyatı 0 TL'den büyük olmalıdır.")
    .max(99_999_999, "Gece fiyatı geçersiz bir değer."),
  capacity: z
    .int("Kişi sayısı tam sayı olmalıdır.")
    .min(1, "Kapasite en az 1 kişi olmalıdır.")
    .max(16, "Kapasite en fazla 16 kişi olabilir."),
  vehicleType: vehicleTypeField,
  brand: z.string().trim().max(60, "Marka adı en fazla 60 karakter olabilir.").nullish(),
  model: z.string().trim().max(60, "Model adı en fazla 60 karakter olabilir.").nullish(),
  transmission: transmissionField,
  fuel: fuelField,
  licenseRequired: licenseRequiredField,
  minDriverAge: z
    .int("Minimum sürücü yaşı tam sayı olmalıdır.")
    .min(18, "Minimum sürücü yaşı en az 18 olmalıdır.")
    .max(99, "Minimum sürücü yaşı en fazla 99 olabilir.")
    .nullish(),
  minRentalDays: z
    .int("Minimum kiralama süresi tam sayı olmalıdır.")
    .min(1, "Minimum kiralama süresi en az 1 gün olmalıdır.")
    .max(30, "Minimum kiralama süresi en fazla 30 gün olabilir."),
  year: z
    .int("Üretim yılı tam sayı olmalıdır.")
    .min(1900, "Üretim yılı 1900'den önce olamaz.")
    .max(2100, "Geçerli bir üretim yılı girin.")
    .nullish(),
  weightKg: z
    .int("Ağırlık tam sayı olmalıdır.")
    .min(1, "Ağırlık en az 1 kg olmalıdır.")
    .max(10_000, "Ağırlık en fazla 10.000 kg olabilir.")
    .nullish(),
  lengthM: z
    .number("Uzunluk sayısal olmalıdır.")
    .min(1, "Uzunluk en az 1 metre olmalıdır.")
    .max(30, "Uzunluk en fazla 30 metre olabilir.")
    .nullish(),
  amenities: z
    .array(
      z.enum(AMENITY_KEYS, "Geçersiz olanak seçimi."),
      "Olanaklar bir liste olmalıdır.",
    )
    .max(AMENITIES.length, "En fazla 17 olanak seçebilirsiniz."),
  houseRules: z
    .string()
    .trim()
    .max(3000, "Ev kuralları en fazla 3000 karakter olabilir.")
    .nullish(),
  photoUrls: z
    .array(
      z.string("Fotoğraf adresi metin olmalıdır.").min(1, "Fotoğraf adresi boş olamaz."),
      "Fotoğraflar bir liste olmalıdır.",
    )
    .max(MAX_PHOTOS, `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz.`),
  // NOT: `status`/`ownerId` BİLEREK şemada yok. Zod v4 object bilinmeyen
  // anahtarları default olarak yok sayar (strip) — payload'da status:"ACTIVE"
  // gelse bile parse edilir ve hiçbir servis onu DB'ye YAZMAZ (sunucu otoriter:
  // createListingCore sabit DRAFT + ownerId=user.id yazar). Şemaya almak
  // gereksiz `ListingInput.status` alanı davet ederdi.
});

export type ListingInput = z.infer<typeof listingSchema>;

/** İlan güncelleme: alan alan (partial) — her alan mevcutken aynı kurallara tabi. */
export const listingUpdateSchema = listingSchema.partial();

export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
