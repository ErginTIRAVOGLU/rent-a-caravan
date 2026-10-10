import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// Mock next-auth
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
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
  usePathname: () => "/hesap/mesajlar",
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom setup for testing
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/hesap/mesajlar page", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing1: Awaited<ReturnType<typeof makeListing>>;
  let listing2: Awaited<ReturnType<typeof makeListing>>;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing1 = await prisma.listing.create({ data: makeListing(owner.id, { title: "İlan 1" }) });
    listing2 = await prisma.listing.create({ data: makeListing(owner.id, { title: "İlan 2" }) });

    await prisma.conversation.create({
      data: { listingId: listing1.id, renterId: renter.id, ownerId: owner.id },
    });
    await prisma.conversation.create({
      data: { listingId: listing2.id, renterId: renter.id, ownerId: owner.id },
    });
  });

  it("sohbet listesi render edilir", async () => {
    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: renter.id,
      name: renter.name,
      email: renter.email,
      role: "USER",
      isBanned: false,
    });

    const { default: MesajlarPage } = await import("../../../src/app/hesap/mesajlar/page");
    render(await MesajlarPage());

    expect(screen.getByText("Mesajlarım")).toBeInTheDocument();
    expect(screen.getByText("İlan 1")).toBeInTheDocument();
    expect(screen.getByText("İlan 2")).toBeInTheDocument();
  });

  it("unread badge gösterilir", async () => {
    const convs = await prisma.conversation.findMany({ where: { renterId: renter.id } });
    await prisma.message.createMany({
      data: [
        { conversationId: convs[0].id, senderId: owner.id, content: "Owner mesajı" },
        { conversationId: convs[0].id, senderId: owner.id, content: "Başka mesaj" },
      ],
    });

    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: renter.id,
      name: renter.name,
      email: renter.email,
      role: "USER",
      isBanned: false,
    });

    const { default: MesajlarPage } = await import("../../../src/app/hesap/mesajlar/page");
    render(await MesajlarPage());

    expect(screen.getByText("2")).toBeInTheDocument(); // unread badge
  });

  it("sohbet yoksa boş durum gösterilir", async () => {
    await prisma.conversation.deleteMany({ where: { renterId: renter.id } });

    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: renter.id,
      name: renter.name,
      email: renter.email,
      role: "USER",
      isBanned: false,
    });

    const { default: MesajlarPage } = await import("../../../src/app/hesap/mesajlar/page");
    render(await MesajlarPage());

    expect(screen.getByText("Henüz mesajınız yok")).toBeInTheDocument();
    expect(screen.getByText("Karavan Arayın")).toBeInTheDocument();
  });
});
