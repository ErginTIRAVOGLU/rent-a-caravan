import { UploadThingError } from "uploadthing/server";

import { validatePhotoFiles, type UploadableFile } from "../lib/upload";

/**
 * imageUploader middleware gövdesi (dışa açık: regresyon testleri gerçeği
 * yansıtan metadata-only nesnelerle çağırır). Yalnız metadata doğrulaması
 * yapar — UploadThing presigned-URL akışında middleware dosya BYTES'ları
 * gelmeden çalışır (`FileUploadData` yalnız `{ name, size, type,
 * customId?, lastModified? }` JSON metadata'sıdır; `stream()` YOK). Bu
 * yüzden imza kontrolü burada YAPILAMAZ; istemcide yapılır (PhotoUploader,
 * `checkPhotoSignature` — gerçek `File` nesneleri üzerinde, `startUpload`
 * öncesi).
 */
export async function imageUploaderMiddleware({
  files,
}: {
  files: readonly UploadableFile[];
}): Promise<Record<string, never>> {
  // Sunucu otoriter: istemci doğrulaması atlatılsa bile adet/tür/boyut
  // burada tekrar sınanır. Oturum kontrolü route sarmalayıcısında (401).
  const check = validatePhotoFiles(files, 0);
  if (!check.ok) {
    throw new UploadThingError({ code: "BAD_REQUEST", message: check.error });
  }
  return {};
}
