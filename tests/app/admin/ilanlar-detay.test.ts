// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /admin/ilanlar/[id] — ilan önizleme: admin her durumu görür (PENDING dahil),
// herkese açık /ilan/[id] PENDING'de 404 verir. Kuyruk satırlarında İncele linki.

const { authMock, redirectMock, notFoundMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

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
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/ilanlar/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function setupAdminSession(user: { id: string; name: string; email: string }) {
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "ADMIN",
      isBanned: false,
    },
  });
}

function setupMemberSession(user: { id: string; name: string; email: string }) {
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "USER",
      isBanned: false,
    },
  });
}

async function renderAdminDetailPage(id: string) {
  const { default: AdminListingDetailPage } = await import(
    "../../../src/app/admin/ilanlar/[id]/page"
  );
  return render(await AdminListingDetailPage({ params: Promise.resolve({ id }) }));
}

describe("/admin/ilanlar/[id] — önizleme", () => {
  it("admin PENDING ilanı görür: başlık + fotoğraf + açıklama + sahip", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    const owner = await prisma.user.create({
      data: makeUser({
        email: "sahip@test.com",
        name: "İlan Sahibi",
      }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, {
        title: "Bolu Dağ Evi Karavanı",
        description: "Dağ havasında konforlu karavan deneyimi.",
        status: "PENDING",
        photoUrls: ["https://ornek.test/foto-1.jpg"],
        houseRules: "Evcil hayvan yasaktır.",
      }),
    });
    setupAdminSession(admin);

    const { getByRole, getByText, getByAltText } = await renderAdminDetailPage(
      listing.id,
    );

    expect(
      getByRole("heading", { level: 1, name: "Bolu Dağ Evi Karavanı" }),
    ).toBeInTheDocument();
    expect(
      getByText("Dağ havasında konforlu karavan deneyimi."),
    ).toBeInTheDocument();
    expect(getByText("İlan Sahibi")).toBeInTheDocument();
    expect(getByText("sahip@test.com")).toBeInTheDocument();
    expect(getByAltText(/fotoğraf 1/i)).toHaveAttribute(
      "src",
      "https://ornek.test/foto-1.jpg",
    );
    expect(getByText("Evcil hayvan yasaktır.")).toBeInTheDocument();
    // Karar düğmeleri aynı sayfada
    expect(getByRole("button", { name: "Onayla" })).toBeInTheDocument();
  });

  it("non-admin /'e yönlendirilir", async () => {
    const member = await prisma.user.create({
      data: makeUser({ email: "uye@test.com" }),
    });
    const owner = await prisma.user.create({
      data: makeUser({ email: "sahip@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "PENDING" }),
    });
    setupMemberSession(member);

    await expect(renderAdminDetailPage(listing.id)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("olmayan id 404 verir", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    setupAdminSession(admin);

    await expect(renderAdminDetailPage("olmayan-id")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("PENDING ilan herkese açık sayfada 404 ama admin sayfasında görünür", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    const owner = await prisma.user.create({
      data: makeUser({ email: "sahip@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, {
        title: "Gizli Kalan Karavan",
        status: "PENDING",
      }),
    });

    const { default: PublicListingPage } = await import(
      "../../../src/app/ilan/[id]/page"
    );
    await expect(
      PublicListingPage({
        params: Promise.resolve({ id: listing.id }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    setupAdminSession(admin);
    const { getByRole } = await renderAdminDetailPage(listing.id);
    expect(
      getByRole("heading", { level: 1, name: "Gizli Kalan Karavan" }),
    ).toBeInTheDocument();
  });

  it("REJECTED ilanda red gerekçesi görünür", async () => {
    const admin = await prisma.user.create({
      data: makeUser({ email: "admin@test.com", role: "ADMIN" }),
    });
    const owner = await prisma.user.create({
      data: makeUser({ email: "sahip@test.com" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, {
        status: "REJECTED",
        rejectionReason: "Fotoğraflar yetersiz.",
      }),
    });
    setupAdminSession(admin);

    const { getByText } = await renderAdminDetailPage(listing.id);
    expect(getByText("Fotoğraflar yetersiz.")).toBeInTheDocument();
  });
});

describe("/admin/ilanlar — İncele linkleri", () => {
  it("dört bölümün her satırında detay sayfasına İncele linki var", async () => {
    const owner = await prisma.user.create({
      data: makeUser({ email: "sahip@test.com" }),
    });
    const fixtures = [
      { title: "Bekleyen Karavan", status: "PENDING" },
      { title: "Yayındaki Karavan", status: "ACTIVE" },
      { title: "Duraklatılmış Karavan", status: "PAUSED" },
      { title: "Reddedilmiş Karavan", status: "REJECTED" },
    ] as const;
    const created = [];
    for (const fixture of fixtures) {
      created.push(
        await prisma.listing.create({
          data: makeListing(owner.id, {
            title: fixture.title,
            status: fixture.status,
          }),
        }),
      );
    }

    const { default: AdminListingsPage } = await import(
      "../../../src/app/admin/ilanlar/page"
    );
    const { getAllByRole } = render(await AdminListingsPage());

    for (const listing of created) {
      const links = getAllByRole("link", { name: "İncele" }).filter(
        (link) => link.getAttribute("href") === `/admin/ilanlar/${listing.id}`,
      );
      expect(links.length).toBeGreaterThanOrEqual(1);
    }
  });
});
