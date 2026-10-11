// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /admin/sikayetler kuyruğu — getReportsCore ile gerçek veri; satırlar
// gerekçe, bildiren, hedef linki, durum rozeti ve tarih gösterir. Durum
// geçişleri matriste olan düğmelerle sunulur (OPEN→İncele, REVIEWING→Kapat,
// CLOSED terminal).

// Hoisted auth mock
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

// Mock next-auth
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: authMock,
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/sikayetler",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

// jsdom setup: `@vitest-environment jsdom` (dosya başı) gerçek jsdom
// ortamını kurar — RTL render + rol sorguları için yeterlidir.

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    user: {
      id: "admin-session",
      name: "Yönetici",
      email: "admin@karavan.test",
      role: "ADMIN",
      isBanned: false,
    },
  });
});

async function renderAdminPage() {
  const { default: SikayetlerPage } = await import(
    "../../../src/app/admin/sikayetler/page"
  );
  return render(await SikayetlerPage());
}

describe("/admin/sikayetler page", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let reporter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    reporter = await prisma.user.create({
      data: makeUser({ email: "reporter@test.com", name: "Bildiren Kişi" }),
    });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Antalya Karavan", status: "ACTIVE" }),
    });
  });

  it("şikayet yoksa boş durum gösterilir", async () => {
    const { getByText } = await renderAdminPage();

    expect(getByText(/Henüz şikayet yok/i)).toBeInTheDocument();
  });

  it("şikayet satırı: gerekçe, bildiren, hedef linki, durum rozeti ve tarih", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Fotoğraflar gerçeği yansıtmıyor.",
        createdAt: new Date("2026-03-05T00:00:00Z"),
      },
    });

    const { getByText } = await renderAdminPage();

    expect(getByText("Fotoğraflar gerçeği yansıtmıyor.")).toBeInTheDocument();
    expect(getByText("Bildiren Kişi")).toBeInTheDocument();
    expect(getByText("reporter@test.com")).toBeInTheDocument();
    expect(getByText("İlan")).toBeInTheDocument();
    expect(getByText("Açık")).toBeInTheDocument();
    expect(getByText("05.03.2026")).toBeInTheDocument();

    const link = getByText("Antalya Karavan").closest("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(`/ilan/${listing.id}`);
  });

  it("OPEN şikayette inceleniyora geçiş düğmesi sunulur", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Fotoğraflar gerçeği yansıtmıyor.",
      },
    });

    const { getByText, queryByText } = await renderAdminPage();

    expect(getByText("İncele")).toBeInTheDocument();
    expect(queryByText("Kapat")).not.toBeInTheDocument();
  });

  it("REVIEWING şikayette kapatma düğmesi sunulur", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Fotoğraflar gerçeği yansıtmıyor.",
        status: "REVIEWING",
      },
    });

    const { getByText, queryByText } = await renderAdminPage();

    expect(getByText("Kapat")).toBeInTheDocument();
    expect(queryByText("İncele")).not.toBeInTheDocument();
    expect(getByText("İnceleniyor")).toBeInTheDocument();
  });

  it("CLOSED şikayette geçiş düğmesi yoktur (terminal durum)", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Fotoğraflar gerçeği yansıtmıyor.",
        status: "CLOSED",
      },
    });

    const { getByText, queryByText } = await renderAdminPage();

    expect(getByText("Kapatıldı")).toBeInTheDocument();
    expect(queryByText("İncele")).not.toBeInTheDocument();
    expect(queryByText("Kapat")).not.toBeInTheDocument();
  });

  it("silinmiş hedefte kırık link gösterilmez", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Fotoğraflar gerçeği yansıtmıyor.",
      },
    });
    await prisma.listing.delete({ where: { id: listing.id } });

    const { getByText, container } = await renderAdminPage();

    expect(getByText(/Silinmiş ilan/i)).toBeInTheDocument();
    expect(container.querySelector("a[href*='/ilan/']")).toBeNull();
  });

  it("USER hedefi yönetim kullanıcı listesine linklenir", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "USER",
        targetId: owner.id,
        reason: "Hesap sahte görünüyor.",
      },
    });

    const { getByText } = await renderAdminPage();

    expect(getByText("Kullanıcı")).toBeInTheDocument();
    const link = getByText("Test Kullanıcısı").closest("a");
    expect(link?.getAttribute("href")).toBe("/admin/kullanicilar");
  });

  it("admin oturumu kullanılır (requireAdmin)", async () => {
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: "LISTING",
        targetId: listing.id,
        reason: "Fotoğraflar gerçeği yansıtmıyor.",
      },
    });

    const { getByText } = await renderAdminPage();

    expect(getByText("Şikayetler")).toBeInTheDocument();
    expect(authMock).toHaveBeenCalled();
    expect(admin.id).toBeTruthy();
  });
});
