import { expect, it } from "vitest";

import {
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
  MAX_PHOTOS,
  validatePhotoFiles,
  checkPhotoSignature,
  extractFileKey,
} from "../src/lib/upload";

/**
 * Saf dosya tanımı — validatePhotoFiles yalnız { name, size, type } okur
 * (framework bağımlılığı yok, saf fonksiyon).
 */
function photoFile(
  overrides: Partial<{ name: string; size: number; type: string }> = {},
) {
  return { name: "karavan.jpg", size: 1024 * 100, type: "image/jpeg", ...overrides };
}

/** Geçerli dosyalardan oluşan liste. */
function photoFiles(count: number) {
  return Array.from({ length: count }, () => photoFile());
}

it("11 dosya → fail (MAX_PHOTOS aşıldı)", () => {
  const result = validatePhotoFiles(photoFiles(11), 0);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain(String(MAX_PHOTOS));
    expect(result.field).toBe("photoUrls");
  }
});

it('type: "image/gif" → fail', () => {
  const result = validatePhotoFiles(
    [photoFile({ name: "hareket.gif", type: "image/gif" })],
    0,
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("image/gif");
  }
});

it("6 MB dosya → fail", () => {
  const result = validatePhotoFiles(
    [photoFile({ name: "panorama.jpg", size: 6 * 1024 * 1024 })],
    0,
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("panorama.jpg");
    expect(result.error).toContain("MB");
  }
});

it("existingCount: 9 + 2 dosya → fail (toplam 11 > 10)", () => {
  const result = validatePhotoFiles(photoFiles(2), 9);

  expect(result.ok).toBe(false);
});

it("3 geçerli dosya → ok", () => {
  const result = validatePhotoFiles(photoFiles(3), 0);

  expect(result).toEqual({ ok: true, data: true });
});

it("existingCount: 8 + 2 dosya → ok (tam kapasite, sınır aşılmadı)", () => {
  const result = validatePhotoFiles(photoFiles(2), 8);

  expect(result.ok).toBe(true);
});

it("existingCount: 10 + 1 dosya → fail (zaten dolu)", () => {
  const result = validatePhotoFiles(photoFiles(1), 10);

  expect(result.ok).toBe(false);
});

it("0 baytlık dosya → fail", () => {
  const result = validatePhotoFiles([photoFile({ size: 0 })], 0);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("Boş dosya");
  }
});

it("boş dosya listesi (yer müsait) → ok", () => {
  const result = validatePhotoFiles([], 4);

  expect(result.ok).toBe(true);
});

it("sabitler: 5 MB, jpeg/png/webp, MAX_PHOTOS validators/listing ile aynı", () => {
  expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  expect([...ALLOWED_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp"]);
  expect(MAX_PHOTOS).toBe(10);
});

describe("checkPhotoSignature", () => {
  const pngHead = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const jpegHead = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const webpHead = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  // Spoof: exe bytes ("MZ…") ama png MIME iddiası.
  const exeBytes = new Uint8Array([
    0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
  ]);

  it("gerçek png başlığını kabul eder", () => {
    expect(checkPhotoSignature(pngHead, "image/png")).toBe(true);
  });

  it("gerçek jpeg ve webp başlıklarını kabul eder", () => {
    expect(checkPhotoSignature(jpegHead, "image/jpeg")).toBe(true);
    expect(checkPhotoSignature(webpHead, "image/webp")).toBe(true);
  });

  it("spoof'lanmış dosyayı reddeder (exe bytes + png MIME)", () => {
    expect(checkPhotoSignature(exeBytes, "image/png")).toBe(false);
  });

  it("yanlış eşleşmeyi reddeder (png bytes + jpeg MIME)", () => {
    expect(checkPhotoSignature(pngHead, "image/jpeg")).toBe(false);
  });

  it("bilinmeyen MIME ve kısa tamponu reddeder", () => {
    expect(checkPhotoSignature(pngHead, "image/gif")).toBe(false);
    expect(checkPhotoSignature(new Uint8Array([0x89, 0x50]), "image/png")).toBe(
      false,
    );
  });
});

describe("extractFileKey", () => {
  it("extracts key from standard UploadThing URL", () => {
    const url = "https://bucket.ufs.sh/f/abc123_key.jpg";
    expect(extractFileKey(url)).toBe("abc123_key.jpg");
  });

  it("extracts key from URL with subdomain", () => {
    const url = "https://myapp.ufs.sh/f/xyz789_image.png";
    expect(extractFileKey(url)).toBe("xyz789_image.png");
  });

  it("extracts key from URL with path-style appId", () => {
    const url = "https://ufs.sh/f/myapp/abc123_key.jpg";
    expect(extractFileKey(url)).toBe("myapp/abc123_key.jpg");
  });

  it("returns null for non-UploadThing URLs", () => {
    expect(extractFileKey("https://example.com/image.jpg")).toBeNull();
    expect(extractFileKey("not-a-url")).toBeNull();
    expect(extractFileKey("")).toBeNull();
  });

  it("returns null for UploadThing URL without /f/ path", () => {
    expect(extractFileKey("https://bucket.ufs.sh/other/path")).toBeNull();
    expect(extractFileKey("https://bucket.ufs.sh/f/")).toBeNull();
  });
});
