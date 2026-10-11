import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import { PHOTO_DELETE_LIMIT } from "../../../src/lib/rate-limit";
import { deleteListingPhotoCore } from "../../../src/server/listings/service";
import { makeListing, makeUser, resetDb } from "../../helpers/db";

// Dış API: UTApi mock'lanır (repo kuralı: harici servisler mock).
const { deleteFilesMock } = vi.hoisted(() => ({
  deleteFilesMock: vi.fn(),
}));

vi.mock("uploadthing/server", () => ({
  UTApi: vi.fn(function (this: unknown) {
    return { deleteFiles: deleteFilesMock };
  }),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  deleteFilesMock.mockResolvedValue({ success: true, deletedCount: 1 });
});

function mockUser(id: string, email: string) {
  return { id, name: "Test", email, role: "USER" as const, isBanned: false };
}

const OWNED_KEY = "2e0fdb64-9957-4262-8e45-f372ba903ac8_owned.jpg";
const OTHER_KEY = "1649353b-04ea-48a2-9db7-31de7f562c8d_baska.jpg";
const ORPHAN_KEY = "aa9353bb-11aa-22bb-33cc-44dd55ee66ff_taslak.jpg";

function photoUrl(key: string) {
  return `https://bucket.ufs.sh/f/${key}`;
}

describe("deleteListingPhotoCore", () => {
  it("sahibinin ilanındaki key → silinir (deleteFiles çağrılır)", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { photoUrls: [photoUrl(OWNED_KEY)] }),
    });

    const result = await deleteListingPhotoCore(
      mockUser(owner.id, owner.email),
      OWNED_KEY,
    );

    expect(result.ok).toBe(true);
    expect(deleteFilesMock).toHaveBeenCalledTimes(1);
    expect(deleteFilesMock).toHaveBeenCalledWith(OWNED_KEY);
  });

  it("başkasının ilanındaki key → reddedilir, deleteFiles ASLA çağrılmaz", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "owner@test.com" }),
    });
    const other = await prisma.user.create({
      data: makeUser({ email: "other@test.com" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { photoUrls: [photoUrl(OTHER_KEY)] }),
    });

    const result = await deleteListingPhotoCore(
      mockUser(other.id, other.email),
      OTHER_KEY,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Bu dosyayı silmeye yetkiniz yok.");
    }
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("hiçbir ilana bağlı olmayan key (taslak) → silinir", async () => {
    const user = await prisma.user.create({
      data: makeUser({ email: "draft@test.com" }),
    });

    const result = await deleteListingPhotoCore(
      mockUser(user.id, user.email),
      ORPHAN_KEY,
    );

    expect(result.ok).toBe(true);
    expect(deleteFilesMock).toHaveBeenCalledTimes(1);
    expect(deleteFilesMock).toHaveBeenCalledWith(ORPHAN_KEY);
  });

  it("bozuk key → reddedilir, deleteFiles çağrılmaz", async () => {
    const user = await prisma.user.create({
      data: makeUser({ email: "bad@test.com" }),
    });

    for (const bad of ["", "../../etc/passwd", "key with spaces", "../x"]) {
      const result = await deleteListingPhotoCore(
        mockUser(user.id, user.email),
        bad,
      );
      expect(result.ok).toBe(false);
    }
    expect(deleteFilesMock).not.toHaveBeenCalled();
  });

  it("hız sınırı aşılınca reddedilir", async () => {
    const user = await prisma.user.create({
      data: makeUser({ email: "hizli@test.com" }),
    });
    const me = mockUser(user.id, user.email);

    for (let i = 0; i < PHOTO_DELETE_LIMIT.limit; i++) {
      const r = await deleteListingPhotoCore(me, `${ORPHAN_KEY}`);
      expect(r.ok).toBe(true);
    }
    const limited = await deleteListingPhotoCore(me, ORPHAN_KEY);
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      expect(limited.error).toContain("Çok fazla istek");
    }
    expect(deleteFilesMock).toHaveBeenCalledTimes(PHOTO_DELETE_LIMIT.limit);
  });

  it("UploadThing hatası → Türkçe fail (yutma yok)", async () => {
    const user = await prisma.user.create({
      data: makeUser({ email: "hata@test.com" }),
    });
    deleteFilesMock.mockRejectedValueOnce(new Error("401 Unauthorized"));

    const result = await deleteListingPhotoCore(
      mockUser(user.id, user.email),
      ORPHAN_KEY,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "Fotoğraf sunucudan silinemedi, lütfen tekrar deneyin.",
      );
    }
  });
});
