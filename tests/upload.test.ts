import { expect, it } from "vitest";

import {
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
  MAX_PHOTOS,
  validatePhotoFiles,
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
