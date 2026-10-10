import {
  createRouteHandler,
  createUploadthing,
  UploadThingError,
  type FileRouter,
} from "uploadthing/server";

import { getSessionUser } from "../../../lib/auth";
import { MAX_PHOTOS, validatePhotoFiles } from "../../../lib/upload";

// UploadThing dosya yönlendiricisi (T7) — tek uç nokta: imageUploader.
// - Tür filtresi: MIME anahtarlarıyla yalnız jpeg/png/webp kabul edilir.
// - Adet: router config'te maxFileCount tür BAŞINA uygulanır; toplam sınır
//   (mevcut fotoğraflarla birlikte) middleware'deki validatePhotoFiles ile
//   korunur (tek seferde en fazla MAX_PHOTOS dosya).
// - Boyut: UploadThing `FileSize` tipi yalnız 2'nin kuvveti çarpanı kabul
//   eder ("4MB"/"8MB", "5MB" DEĞİL); bu yüzden router 8MB yazılır ve asıl
//   5 MB sınırı middleware'de validatePhotoFiles ile uygulanır.
// - Güvenlik: MIME türü ve dosya boyutu dışında "magic byte" imzası doğrulanır
//   (JPEG: FF D8 FF, PNG: 89 50 4E 47 0D 0A 1A 0A, WebP: RIFF....WEBP).
// awaitServerData=false: istemci dosya adresini (ufsUrl) yanıtından alır,
// sunucu verisi beklenmez.

const f = createUploadthing();

/** UploadThing'in middleware'e verdiği dosya nesnesi tipi (native `File` DEĞİL). */
type UploadThingFile = {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  stream(): ReadableStream<Uint8Array>;
};

/**
 * Dosyanın MIME türüne göre magic byte imzasını doğrular.
 * Bu, isminin/MIME'ün spoof edilerek zararlı dosya (ör. PHP, exe) yüklenmesini engeller.
 * İmza kontrolü tek başına dosyanın tamamen güvenli/parse edilebilir olduğunu kanıtlamaz,
 * ancak yanlış türdeki dosyaları erken elemek için etkili bir ilk kapıdır.
 * 
 * Not: UploadThing `FileUploadData` native `File` değil; `arrayBuffer()` yok.
 * `stream()` ile `ReadableStream` alır, ilk 12 byte'ı okuyup kontrol ederiz.
 */
const hasValidPhotoSignature = async (file: UploadThingFile): Promise<boolean> => {
  const stream = file.stream();
  const reader = stream.getReader();
  try {
    const { value, done } = await reader.read();
    if (done || !value) return false;
    const bytes = new Uint8Array(value);
    // İlk chunk genelde yeterli; değilse bir chunk daha oku (nadir)
    if (bytes.length < 12) {
      const { value: value2, done: done2 } = await reader.read();
      if (!done2 && value2) {
        const combined = new Uint8Array(bytes.length + value2.length);
        combined.set(bytes);
        combined.set(value2, bytes.length);
        return checkSignature(combined, file.type);
      }
    }
    return checkSignature(bytes, file.type);
  } finally {
    reader.releaseLock();
  }
};

const checkSignature = (bytes: Uint8Array, mimeType: string): boolean => {
  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && // 'R'
      bytes[1] === 0x49 && // 'I'
      bytes[2] === 0x46 && // 'F'
      bytes[3] === 0x46 && // 'F'
      bytes[8] === 0x57 && // 'W'
      bytes[9] === 0x45 && // 'E'
      bytes[10] === 0x42 && // 'B'
      bytes[11] === 0x50 // 'P'
    );
  }
  return false;
};

const ourFileRouter = {
  imageUploader: f(
    {
      "image/jpeg": { maxFileSize: "8MB", maxFileCount: MAX_PHOTOS },
      "image/png": { maxFileSize: "8MB", maxFileCount: MAX_PHOTOS },
      "image/webp": { maxFileSize: "8MB", maxFileCount: MAX_PHOTOS },
    },
    { awaitServerData: false },
  )
    .middleware(async ({ files }) => {
      // Sunucu otoriter: istemci doğrulaması atlatılsa bile adet/tür/boyut
      // burada tekrar sınanır. Oturum kontrolü route.ts sarmalayıcısında (401).
      // Güvenlik: Magic byte imzası ile MIME türü doğrulaması.
      for (const file of files) {
        // UploadThing `FileUploadData` tipi TS'de `stream()` içermiyor ama runtime'da vardır
        if (!(await hasValidPhotoSignature(file as unknown as UploadThingFile))) {
          throw new UploadThingError({
            code: "BAD_REQUEST",
            message: "Dosya içeriği türüyle eşleşmiyor.",
          });
        }
      }
      const check = validatePhotoFiles(files, 0);
      if (!check.ok) {
        throw new UploadThingError({ code: "BAD_REQUEST", message: check.error });
      }
      return {};
    })
    .onUploadComplete(async () => {
      // Kalıcılık istemciden: başarı durumunda ufsUrl photoUrls'e yazılır.
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

const handler = createRouteHandler({ router: ourFileRouter });

/**
 * Uç noktası istekleri:
 * - Tarayıcının hazırlık isteği (uploadthing-hook başlığı OLMAYAN POST)
 *   oturum ister; oturum yoksa 401 (Türkçe mesaj, UploadThing hata biçimi).
 * - callback/error istekleri UploadThing sunucusundan imzalı gelir
 *   (uploadthing-hook + x-uploadthing-signature); oturum sıkmaz.
 * - GET yalnız herkese açık yönlendirici yapılandırmasını döner.
 */
async function uploadthingHandler(request: Request): Promise<Response> {
  const isBrowserUploadRequest =
    request.method === "POST" && !request.headers.has("uploadthing-hook");
  if (isBrowserUploadRequest) {
    const user = await getSessionUser();
    if (!user) {
      return Response.json(
        { message: "Oturum bulunamadı. Lütfen yeniden giriş yapın." },
        { status: 401 },
      );
    }
  }
  return handler(request);
}

export { uploadthingHandler as GET, uploadthingHandler as POST };
