import {
  createRouteHandler,
  createUploadthing,
  type FileRouter,
} from "uploadthing/server";

import { getSessionUser } from "../../../lib/auth";
import { MAX_PHOTOS } from "../../../lib/upload";
import { imageUploaderMiddleware } from "../../../server/uploadthing";

// UploadThing dosya yönlendiricisi (T7) — tek uç nokta: imageUploader.
// - Tür filtresi: MIME anahtarlarıyla yalnız jpeg/png/webp kabul edilir.
// - Adet: router config'te maxFileCount tür BAŞINA uygulanır; toplam sınır
//   (mevcut fotoğraflarla birlikte) middleware'deki validatePhotoFiles ile
//   korunur (tek seferde en fazla MAX_PHOTOS dosya).
// - Boyut: UploadThing `FileSize` tipi yalnız 2'nin kuvveti çarpanı kabul
//   eder ("4MB"/"8MB", "5MB" DEĞİL); bu yüzden router 8MB yazılır ve asıl
//   5 MB sınırı middleware'de validatePhotoFiles ile uygulanır.
// - Güvenlik: MIME türü ve dosya boyutu burada (metadata aşamasında)
//   sınanır. Magic-byte imza kontrolü burada YAPILAMAZ: UploadThing
//   presigned-URL akışında middleware dosya BYTES'ları gelmeden çalışır;
//   `FileUploadData` yalnız `{ name, size, type, customId?, lastModified? }`
//   JSON metadata'sıdır (`stream()`/`arrayBuffer()` YOK). İmza kontrolü
//   istemcide yapılır (PhotoUploader, `checkPhotoSignature` — gerçek `File`
//   nesneleri üzerinde, `startUpload` öncesi).
// awaitServerData=false: istemci dosya adresini (ufsUrl) yanıtından alır,
// sunucu verisi beklenmez.

const f = createUploadthing();

const ourFileRouter = {
  imageUploader: f(
    {
      "image/jpeg": { maxFileSize: "8MB", maxFileCount: MAX_PHOTOS },
      "image/png": { maxFileSize: "8MB", maxFileCount: MAX_PHOTOS },
      "image/webp": { maxFileSize: "8MB", maxFileCount: MAX_PHOTOS },
    },
    { awaitServerData: false },
  )
    .middleware(imageUploaderMiddleware)
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
