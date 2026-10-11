// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";

import { prisma } from "../../../../src/lib/prisma";
import { makeUser, resetDb } from "../../../helpers/db";

// Profil sayfasındaki "Bildir" akışı — gerçek sunucu eylemiyle çalışır:
// hedef USER = oturumdaki hesap; başarılı gönderim DB'de açık şikayet yazar.

// Hoisted auth mock
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
  usePathname: () => "/hesap/profil",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
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

async function renderProfilePage() {
  const { default: ProfilPage } = await import("../../../../src/app/hesap/profil/page");
  return render(await ProfilPage());
}

describe("/hesap/profil — Bildir dialogu", () => {
  let user: Awaited<ReturnType<typeof makeUser>>;

  beforeEach(async () => {
    user = await prisma.user.create({ data: makeUser({ email: "uye@test.com" }) });
  });

  it("hesap bildirimi bölümü ve 'Bildir' düğmesi gösterilir", async () => {
    setupSession(user);

    const { getByText, queryByRole } = await renderProfilePage();

    expect(getByText("Hesap Bildirimi")).toBeInTheDocument();
    expect(getByText("Bildir")).toBeInTheDocument();
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("geçerli gerekçe → hedefi kendi hesabı olan şikayet yazılır", async () => {
    setupSession(user);

    const { getByText, getByRole, getByLabelText } = await renderProfilePage();

    await act(async () => {
      fireEvent.click(getByText("Bildir"));
    });
    const textarea = getByLabelText(/gerekçe/i) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, {
        target: { value: "Hesabımın ele geçirildiğini düşünüyorum." },
      });
    });
    await act(async () => {
      fireEvent.click(getByRole("button", { name: "Gönder" }));
    });

    await waitFor(async () => {
      const saved = await prisma.report.findFirst({
        where: { reporterId: user.id, targetType: "USER" },
      });
      expect(saved).not.toBeNull();
      expect(saved?.targetId).toBe(user.id);
      expect(saved?.status).toBe("OPEN");
    });
  });
});
