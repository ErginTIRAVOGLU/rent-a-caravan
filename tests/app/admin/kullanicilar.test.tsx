// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, resetDb } from "../../helpers/db";

// /admin/kullanicilar — `durum` sekmeleri (Tümü/Aktif/Banlı) + sunucu tarafı
// `?q=` araması (ad veya e-posta). Rol/ban rozetleri korunur.

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: authMock,
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn() }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/kullanicilar",
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

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function setupAdmin(id = "admin-1") {
  authMock.mockResolvedValue({
    user: {
      id,
      name: "Yönetici",
      email: "admin@test.com",
      role: "ADMIN",
      isBanned: false,
    },
  });
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const { default: AdminUsersPage } = await import(
    "../../../src/app/admin/kullanicilar/page"
  );
  return render(
    await AdminUsersPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

describe("/admin/kullanicilar", () => {
  it("metadata başlığı Kullanıcılar", async () => {
    const { metadata } = await import(
      "../../../src/app/admin/kullanicilar/page"
    );
    expect(metadata.title).toBe("Kullanıcılar");
  });

  it("varsayılan sekme all: tüm kullanıcıları gösterir ve sayaçları hesaplar", async () => {
    await prisma.user.create({ data: makeUser({ name: "Aktif Kişi" }) });
    await prisma.user.create({
      data: makeUser({ name: "Banlı Kişi", isBanned: true }),
    });
    setupAdmin();

    await renderPage();

    const table = screen.getByTestId("admin-users-table");
    expect(within(table).getByText("Aktif Kişi")).toBeInTheDocument();
    expect(within(table).getByText("Banlı Kişi")).toBeInTheDocument();

    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-active")).toHaveTextContent("1");
    expect(screen.getByTestId("tab-count-banned")).toHaveTextContent("1");
  });

  it("durum=banned yalnız banlı kullanıcıları gösterir", async () => {
    await prisma.user.create({ data: makeUser({ name: "Aktif Kişi" }) });
    await prisma.user.create({
      data: makeUser({ name: "Banlı Kişi", isBanned: true }),
    });
    setupAdmin();

    await renderPage({ durum: "banned" });

    const table = screen.getByTestId("admin-users-table");
    expect(within(table).getByText("Banlı Kişi")).toBeInTheDocument();
    expect(within(table).queryByText("Aktif Kişi")).not.toBeInTheDocument();
  });

  it("durum=active yalnız aktif kullanıcıları gösterir", async () => {
    await prisma.user.create({ data: makeUser({ name: "Aktif Kişi" }) });
    await prisma.user.create({
      data: makeUser({ name: "Banlı Kişi", isBanned: true }),
    });
    setupAdmin();

    await renderPage({ durum: "active" });

    const table = screen.getByTestId("admin-users-table");
    expect(within(table).getByText("Aktif Kişi")).toBeInTheDocument();
    expect(within(table).queryByText("Banlı Kişi")).not.toBeInTheDocument();
  });

  it("geçersiz durum all davranışına düşer", async () => {
    await prisma.user.create({ data: makeUser({ name: "Aktif Kişi" }) });
    await prisma.user.create({
      data: makeUser({ name: "Banlı Kişi", isBanned: true }),
    });
    setupAdmin();

    await renderPage({ durum: "gecersiz" });

    const table = screen.getByTestId("admin-users-table");
    expect(within(table).getByText("Aktif Kişi")).toBeInTheDocument();
    expect(within(table).getByText("Banlı Kişi")).toBeInTheDocument();
  });

  it("q ad veya e-posta üzerinde büyük/küçük harf duyarsız eşleşir", async () => {
    await prisma.user.create({
      data: makeUser({ name: "Ali Veli", email: "ali@test.com" }),
    });
    await prisma.user.create({
      data: makeUser({ name: "Ayşe Yılmaz", email: "ayse@ornek.com" }),
    });
    setupAdmin();

    // E-posta ile ara.
    await renderPage({ q: "ali@" });

    const table = screen.getByTestId("admin-users-table");
    expect(within(table).getByText("Ali Veli")).toBeInTheDocument();
    expect(within(table).queryByText("Ayşe Yılmaz")).not.toBeInTheDocument();
  });

  it("q ada göre de eşleşir", async () => {
    await prisma.user.create({
      data: makeUser({ name: "Ali Veli", email: "ali@test.com" }),
    });
    await prisma.user.create({
      data: makeUser({ name: "Ayşe Yılmaz", email: "ayse@ornek.com" }),
    });
    setupAdmin();

    await renderPage({ q: "yılmaz" });

    const table = screen.getByTestId("admin-users-table");
    expect(within(table).getByText("Ayşe Yılmaz")).toBeInTheDocument();
    expect(within(table).queryByText("Ali Veli")).not.toBeInTheDocument();
  });

  it("sayaçlar q'dan bağımsız tam dağılımı gösterir", async () => {
    await prisma.user.create({ data: makeUser({ name: "Ali" }) });
    await prisma.user.create({ data: makeUser({ name: "Ayşe" }) });
    await prisma.user.create({
      data: makeUser({ name: "Banlı", isBanned: true }),
    });
    setupAdmin();

    await renderPage({ q: "ali" });

    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("3");
    expect(screen.getByTestId("tab-count-active")).toHaveTextContent("2");
    expect(screen.getByTestId("tab-count-banned")).toHaveTextContent("1");
  });

  it("filtre boşsa tek EmptyState ve tek 'Aramayı temizle' linki gösterir", async () => {
    await prisma.user.create({ data: makeUser({ name: "Ali" }) });
    setupAdmin();

    await renderPage({ q: "zzz-eslesmez" });

    expect(
      screen.getByText("Aramanızla eşleşen kullanıcı yok"),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Aramayı temizle" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/admin/kullanicilar");
    expect(screen.queryByTestId("admin-users-table")).not.toBeInTheDocument();
  });

  it("hiç kullanıcı yoksa tek CTA'lı boş durum gösterir", async () => {
    setupAdmin();

    await renderPage();

    expect(screen.getByText("Kayıtlı kullanıcı yok")).toBeInTheDocument();
    const cta = screen
      .getAllByRole("link")
      .filter((link) => link.textContent === "Genel Bakışa dön");
    expect(cta).toHaveLength(1);
    expect(cta[0]).toHaveAttribute("href", "/admin");
  });

  it("masaüstü tablo ve mobil kart aynı veriyi (rol + ban rozeti + aksiyon) taşır", async () => {
    await prisma.user.create({
      data: makeUser({
        id: "u1",
        name: "Ali Veli",
        email: "ali@test.com",
        role: "ADMIN",
      }),
    });
    await prisma.user.create({
      data: makeUser({
        id: "u2",
        name: "Banlı Kişi",
        email: "banli@test.com",
        isBanned: true,
      }),
    });
    setupAdmin();

    await renderPage();

    for (const testid of ["admin-users-table", "admin-users-cards"]) {
      const scope = screen.getByTestId(testid);
      expect(within(scope).getByText("Ali Veli")).toBeInTheDocument();
      expect(within(scope).getByText(/ali@test\.com/)).toBeInTheDocument();
      expect(within(scope).getByText("Yönetici")).toBeInTheDocument();
      expect(within(scope).getByText("Banlı Kişi")).toBeInTheDocument();
      expect(within(scope).getByText(/banli@test\.com/)).toBeInTheDocument();
      expect(within(scope).getByText("Banlı")).toBeInTheDocument();
      expect(
        within(scope).getByRole("button", { name: "Banı Aç" }),
      ).toBeInTheDocument();
      expect(
        within(scope).getByRole("button", { name: "Banla" }),
      ).toBeInTheDocument();
    }
  });

  it("kendi satırında ban düğmesi yerine 'Kendi hesabınız' gösterir", async () => {
    const self = await prisma.user.create({
      data: makeUser({ name: "Yönetici", email: "admin@test.com" }),
    });
    setupAdmin(self.id);

    await renderPage();

    const table = screen.getByTestId("admin-users-table");
    expect(
      within(table).getByText("Kendi hesabınız"),
    ).toBeInTheDocument();
  });

  it("arama formu GET'tir ve mevcut durumu gizli input'ta korur", async () => {
    await prisma.user.create({ data: makeUser({ name: "Ali" }) });
    setupAdmin();

    await renderPage({ durum: "banned", q: "ali" });

    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/admin/kullanicilar");
    expect(within(form).getByDisplayValue("ali")).toHaveAttribute("name", "q");
    expect(within(form).getByDisplayValue("banned")).toHaveAttribute(
      "name",
      "durum",
    );
  });

  it("sekme bağlantıları mevcut q aramasını korur", async () => {
    await prisma.user.create({ data: makeUser({ name: "Ali" }) });
    setupAdmin();

    await renderPage({ q: "ali" });

    expect(screen.getByRole("link", { name: /Banlı/ })).toHaveAttribute(
      "href",
      "/admin/kullanicilar?q=ali&durum=banned",
    );
  });
});
