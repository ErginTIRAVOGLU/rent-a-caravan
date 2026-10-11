// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// /hesap/ilanlarim/[id]/gecmis — sahip tarafı geçmiş ekranı: kendi ilanının
// geçişlerini kronolojik görür; başkasının ilanı 404 verir.

const { authMock, notFoundMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
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
  redirect: vi.fn(),
  notFound: () => {
    notFoundMock();
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/hesap/ilanlarim/test-id/gecmis",
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

function setupSession(user: { id: string; name: string; email: string }) {
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

async function renderHistoryPage(id: string) {
  const { default: ListingHistoryPage } = await import(
    "../../../src/app/hesap/ilanlarim/[id]/gecmis/page"
  );
  return render(await ListingHistoryPage({ params: Promise.resolve({ id }) }));
}

describe("/hesap/ilanlarim/[id]/gecmis", () => {
  it("sahip geçiş satırlarını görür (eski→yeni + kim)", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: "Geçmişli Karavan" }),
    });
    await prisma.listingStatusHistory.create({
      data: {
        listingId: listing.id,
        fromStatus: "ACTIVE",
        toStatus: "PAUSED",
        actorId: owner.id,
      },
    });
    setupSession(owner);

    const { getByText } = await renderHistoryPage(listing.id);

    expect(getByText("Geçmişli Karavan")).toBeInTheDocument();
    expect(getByText("Yayında → Duraklatıldı")).toBeInTheDocument();
    expect(getByText("İlan sahibi")).toBeInTheDocument();
  });

  it("başkasının ilanı 404 verir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const intruder = await prisma.user.create({ data: makeUser() });
    const listing = await prisma.listing.create({
      data: makeListing(owner.id),
    });
    setupSession(intruder);

    await expect(renderHistoryPage(listing.id)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundMock).toHaveBeenCalled();
  });
});
