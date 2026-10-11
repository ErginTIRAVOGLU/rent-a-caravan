import { describe, expect, it } from "vitest";

import { imageUploaderMiddleware } from "../../../../src/server/uploadthing";

/**
 * Gerçeği yansıtan girdi: UploadThing presigned-URL akışında middleware'e
 * yalnız JSON metadata gelir (`{ name, size, type, lastModified? }` —
 * `stream()`/`arrayBuffer()` YOK). Eski `file.stream()` kontrolü her dosyada
 * `file.stream is not a function` TypeError verip tüm yüklemeleri 500
 * yapıyordu; bu test stream'siz nesnelerle GEÇMELİDİR.
 */
function metadataFile(
  overrides: Partial<{ name: string; size: number; type: string }> = {},
) {
  return {
    name: "karavan.png",
    size: 1024 * 100,
    type: "image/png",
    ...overrides,
  };
}

describe("imageUploaderMiddleware", () => {
  it("stream'siz metadata-only dosyaları kabul eder (yüklemeler 500 vermez)", async () => {
    const files = [metadataFile()];
    // Gerçeklik muhafızı: girdide gerçekten stream/arrayBuffer YOK.
    expect("stream" in files[0]).toBe(false);
    expect("arrayBuffer" in files[0]).toBe(false);

    await expect(imageUploaderMiddleware({ files })).resolves.toEqual({});
  });

  it("desteklenmeyen türü Türkçe mesajla reddeder", async () => {
    const files = [
      metadataFile({ name: "hareket.gif", type: "image/gif" }),
    ];

    await expect(imageUploaderMiddleware({ files })).rejects.toThrow(
      "JPG, PNG veya WebP",
    );
  });

  it("sınırı aşan dosya sayısını reddeder", async () => {
    const files = Array.from({ length: 11 }, () => metadataFile());

    await expect(imageUploaderMiddleware({ files })).rejects.toThrow(
      "fotoğraf",
    );
  });
});
