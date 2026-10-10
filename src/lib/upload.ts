import { fail, ok, type ActionResult } from "./result";
import { MAX_PHOTOS } from "./validators/listing";

// Fotoğraf yükleme kuralları — tek doğrulama kaynağı (istemci PhotoUploader +
// sunucu UploadThing middleware'i aynı fonksiyonu çağırır).
// NOT: MAX_PHOTOS validators/listing.ts'ten gelir (tek tanım); buradan yeniden
// dışa aktarılır — ikinci bağımsız tanım YOK.

export { MAX_PHOTOS };

/** Dosya başına azami boyut: 5 MB. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** İzin verilen içerik türleri (JPG, PNG, WebP). */
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Yükleme öncesi tanınan dosya meta bilgisi (File'dan sadece bunlar okunur). */
export type UploadableFile = { name: string; size: number; type: string };

/**
 * Seçilen dosyaların yüklenebilirliğini dener: toplam adet, boyut ve tür.
 * Safdır — ağ/dosya sistemi yok; istemcide (yükleme öncesi) ve sunucuda
 * (UploadThing middleware) aynı şekilde çalışır.
 */
export function validatePhotoFiles(
  files: readonly UploadableFile[],
  existingCount: number,
): ActionResult<true> {
  if (existingCount + files.length > MAX_PHOTOS) {
    return fail(`En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsiniz.`, "photoUrls");
  }
  for (const file of files) {
    if (file.size <= 0) {
      return fail(`Boş dosya yüklenemez: ${file.name}.`, "photoUrls");
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail(
        `${file.name} çok büyük. En fazla ${MAX_FILE_BYTES / (1024 * 1024)} MB yüklenebilir.`,
        "photoUrls",
      );
    }
    if (!ALLOWED_TYPES.some((allowed) => allowed === file.type)) {
      return fail(
        `${file.name} türü desteklenmiyor (${file.type}). JPG, PNG veya WebP yükleyin.`,
        "photoUrls",
      );
    }
  }
  return ok(true);
}
