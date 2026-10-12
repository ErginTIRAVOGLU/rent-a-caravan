// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, resetDb } from "../../helpers/db";

// /hesap/ilanlarim/yeni — sunucu bileşeni doğrudan render edilir; başlık
// paylaşılan PageHeader'a taşındı (Hesap sayfalarının kabuğa taşınması).

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/hesap/ilanlarim/yeni",
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

// İlan formu bu testte içerik değil; başlık sözleşmesi sınanır.
vi.mock("../../../src/components/ListingForm", () => ({
  ListingForm: () =>
    React.createElement("div", { "data-testid": "listing-form" }),
}));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("/hesap/ilanlarim/yeni", () => {
  it("başlık paylaşılan PageHeader ile görünür", async () => {
    const user = await prisma.user.create({ data: makeUser() });
    authMock.mockResolvedValue({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "USER",
        isBanned: false,
      },
    });

    const { default: YeniIlanPage } = await import(
      "../../../src/app/hesap/ilanlarim/yeni/page"
    );
    const { getByRole } = render(await YeniIlanPage());

    const heading = getByRole("heading", { level: 1, name: "Yeni İlan" });
    expect(heading.className).toContain("section-title");
  });
});
