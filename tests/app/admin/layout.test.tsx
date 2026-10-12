/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { resetDb } from "../../helpers/db";

// /admin panel kabuğu — kapı davranışı (oturum yok → /giris, ADMIN değil → /)
// ve ADMIN'de PanelShell'in yönetim menüsünü render etmesi.

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
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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

// PanelShell → PanelTopbar bağımlılıkları.
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useSession: () => ({
    data: null,
    status: "unauthenticated",
    update: vi.fn(),
  }),
  signOut: vi.fn(),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: 0,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("../../../src/lib/auth-actions", () => ({ signOutAction: vi.fn() }));

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("/admin layout", () => {
  it("oturum yoksa /giris'e yönlendirir", async () => {
    authMock.mockResolvedValue(null);

    const { default: AdminLayout } = await import(
      "../../../src/app/admin/layout"
    );

    await expect(AdminLayout({ children: null })).rejects.toThrow();
    expect(redirectMock).toHaveBeenCalledWith("/giris");
  });

  it("ADMIN olmayan kullanıcıyı /'e yönlendirir", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "u1",
        name: "Üye",
        email: "uye@test.com",
        role: "USER",
        isBanned: false,
      },
    });

    const { default: AdminLayout } = await import(
      "../../../src/app/admin/layout"
    );

    await expect(AdminLayout({ children: null })).rejects.toThrow();
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("ADMIN'de yönetim menüsünü PanelShell ile render eder", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "a1",
        name: "Yönetici",
        email: "admin@test.com",
        role: "ADMIN",
        isBanned: false,
      },
    });

    const { default: AdminLayout } = await import(
      "../../../src/app/admin/layout"
    );
    const ui = await AdminLayout({ children: <p>içerik</p> });
    render(ui);

    expect(screen.getByText("içerik")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /İlanlar/ })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Şikâyetler/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Kullanıcılar/ }),
    ).toBeInTheDocument();
  });
});
