// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";

import { prisma } from "../../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../../helpers/db";

// İlan detayındaki "Bildir" akışı — gerçek sunucu eylemiyle (mock yok)
// çalışır: dialog açılır, gerekçe doğrulanır, başarılı gönderim DB'de OPEN
// şikayet olarak görünür; mükerrer bildirim sunucudan reddedilir.

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
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/ilan/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// jsdom setup: `@vitest-environment jsdom` (dosya başı) gerçek jsdom
// ortamını kurar; burada EK elle global ataması yapılmaz — elle atanan
// JSDOM penceresinde React olay delegasyonu çalışmadığı için fireEvent
// onChange'i tetiklemez (dialog testleri için kritik).

const GEREKCE = "İlan açıklaması fotoğraflarla uyuşmuyor.";

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

function setupSession(user: {
  id: string;
  name: string;
  email: string;
  role?: string;
}) {
  authMock.mockResolvedValue({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ?? "USER",
      isBanned: false,
    },
  });
}

async function renderListingPage(id: string) {
  const { default: IlanDetayPage } = await import(
    "../../../../src/app/ilan/[id]/page"
  );
  return render(
    await IlanDetayPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    }),
  );
}

describe("/ilan/[id] — Bildir dialogu", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
  });

  it("oturumlu kullanıcı 'Bildir' düğmesini görür, dialog kapalıdır", async () => {
    setupSession(renter);

    const { getByText, queryByRole } = await renderListingPage(listing.id);

    expect(getByText("Bildir")).toBeInTheDocument();
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ilan sahibi kendi ilanında 'Bildir' düğmesini görmez", async () => {
    setupSession(owner);

    const { queryByText } = await renderListingPage(listing.id);

    expect(queryByText("Bildir")).not.toBeInTheDocument();
  });

  it("dialog açılır: başlık, gerekçe alanı ve gönder düğmesi gelir", async () => {
    setupSession(renter);

    const { getByText, getByRole } = await renderListingPage(listing.id);

    await act(async () => {
      fireEvent.click(getByText("Bildir"));
    });

    expect(getByRole("dialog")).toBeInTheDocument();
    expect(getByText("İlanı Bildir")).toBeInTheDocument();
    expect(getByText(/en az 5 karakter/i)).toBeInTheDocument();
    expect(getByRole("button", { name: "Gönder" })).toBeDisabled();
  });

  it("kısa gerekçede gönder düğmesi kapalı kalır, kayıt yazılmaz", async () => {
    setupSession(renter);

    const { getByText, getByRole, getByLabelText } = await renderListingPage(
      listing.id,
    );

    await act(async () => {
      fireEvent.click(getByText("Bildir"));
    });
    const textarea = getByLabelText(/gerekçe/i) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "kötü" } });
    });

    expect(getByRole("button", { name: "Gönder" })).toBeDisabled();
    expect(await prisma.report.count()).toBe(0);
  });

  it("geçerli gerekçe → OPEN şikayet veritabanına yazılır, onay mesajı gösterilir", async () => {
    setupSession(renter);

    const { getByText, getByRole, getByLabelText, queryByRole } =
      await renderListingPage(listing.id);

    await act(async () => {
      fireEvent.click(getByText("Bildir"));
    });
    const textarea = getByLabelText(/gerekçe/i) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: GEREKCE } });
    });
    const submit = getByRole("button", { name: "Gönder" });
    expect(submit).toBeEnabled();

    await act(async () => {
      fireEvent.click(submit);
    });

    await waitFor(async () => {
      const saved = await prisma.report.findFirst({
        where: { reporterId: renter.id, targetType: "LISTING" },
      });
      expect(saved).not.toBeNull();
      expect(saved?.reason).toBe(GEREKCE);
      expect(saved?.status).toBe("OPEN");
      expect(saved?.targetId).toBe(listing.id);
    });

    expect(getByText(/Bildiriminiz iletildi/i)).toBeInTheDocument();
    expect(queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aynı kullanıcı ikinci kez bildiremez — sunucu reddi dialogda gösterilir", async () => {
    setupSession(renter);

    const { getByText, getByRole, getByLabelText, findByText } =
      await renderListingPage(listing.id);

    // İlk bildirim
    await act(async () => {
      fireEvent.click(getByText("Bildir"));
    });
    const textarea = getByLabelText(/gerekçe/i) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: GEREKCE } });
    });
    await act(async () => {
      fireEvent.click(getByRole("button", { name: "Gönder" }));
    });
    await waitFor(async () => {
      expect(await prisma.report.count()).toBe(1);
    });

    // İkinci deneme
    await act(async () => {
      fireEvent.click(getByText("Bildir"));
    });
    await act(async () => {
      fireEvent.change(getByLabelText(/gerekçe/i), {
        target: { value: "Tekrar bildiriyorum." },
      });
    });
    await act(async () => {
      fireEvent.click(getByRole("button", { name: "Gönder" }));
    });

    expect(await findByText(/zaten/i)).toBeInTheDocument();
    expect(await prisma.report.count()).toBe(1);
  });
});
