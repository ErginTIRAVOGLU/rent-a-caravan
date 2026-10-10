import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  usePathname: () => "/hesap/mesajlar/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom setup
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

describe("/hesap/mesajlar/[id] page", () => {
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let renter: Awaited<ReturnType<typeof makeUser>>;
  let listing: Awaited<ReturnType<typeof makeListing>>;
  let conversationId: string;

  beforeEach(async () => {
    owner = await prisma.user.create({ data: makeUser({ email: "owner@test.com" }) });
    renter = await prisma.user.create({ data: makeUser({ email: "renter@test.com" }) });
    listing = await prisma.listing.create({ data: makeListing(owner.id, { title: "Test İlanı" }) });
    const conv = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    conversationId = conv.id;

    await prisma.message.createMany({
      data: [
        { conversationId, senderId: renter.id, content: "Merhaba" },
        { conversationId, senderId: owner.id, content: "Merhaba, nasıl yardımcı olabilirim?" },
      ],
    });
  });

  it("sohbet detayı render edilir", async () => {
    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: renter.id,
      name: renter.name,
      email: renter.email,
      role: "USER",
      isBanned: false,
    });

    const { getConversation } = await import("../../../src/server/messages/actions");
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        listing: { select: { id: true, title: true, photoUrls: true, status: true } },
        renter: { select: { id: true, name: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const booking = await prisma.bookingRequest.findFirst({
      where: { listingId: listing.id, renterId: renter.id, status: { in: ["PENDING", "APPROVED", "COMPLETED"] } },
      select: { status: true },
      orderBy: { createdAt: "desc" },
    });
    vi.mocked(getConversation).mockResolvedValue({
      ok: true,
      data: { ...conversation, bookingStatus: booking?.status ?? null },
    });

    const { default: ConversationPage } = await import("../../../src/app/hesap/mesajlar/[id]/page");
    render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }));

    expect(screen.getByText("Test İlanı")).toBeInTheDocument();
    expect(screen.getByText("Merhaba")).toBeInTheDocument();
    expect(screen.getByText("Merhaba, nasıl yardımcı olabilirim?")).toBeInTheDocument();
  });

  it("mesaj gönderimi optimistic UI günceller", async () => {
    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: renter.id,
      name: renter.name,
      email: renter.email,
      role: "USER",
      isBanned: false,
    });

    const { sendMessage } = await import("../../../src/server/messages/actions");
    vi.mocked(sendMessage).mockResolvedValue({ ok: true, data: { id: "new-msg", conversationId, senderId: renter.id, content: "Yeni mesaj", readAt: null, createdAt: new Date() } });

    const { getConversation } = await import("../../../src/server/messages/actions");
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        listing: { select: { id: true, title: true, photoUrls: true, status: true } },
        renter: { select: { id: true, name: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const booking = await prisma.bookingRequest.findFirst({
      where: { listingId: listing.id, renterId: renter.id, status: { in: ["PENDING", "APPROVED", "COMPLETED"] } },
      select: { status: true },
      orderBy: { createdAt: "desc" },
    });
    vi.mocked(getConversation).mockResolvedValue({
      ok: true,
      data: { ...conversation, bookingStatus: booking?.status ?? null },
    });

    const { default: ConversationPage } = await import("../../../src/app/hesap/mesajlar/[id]/page");
    render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }));

    // Mesaj yaz ve gönder
    const input = screen.getByPlaceholderText("Mesajınızı yazın…");
    fireEvent.change(input, { target: { value: "Yeni mesaj" } });
    fireEvent.click(screen.getByText("Gönder"));

    // Optimistic mesaj görünmeli
    await waitFor(() => {
      expect(screen.getByText("Yeni mesaj")).toBeInTheDocument();
    });
  });

  it("sohbet açıldığında mesajlar okundu işaretlenir (markMessagesRead çağrılır)", async () => {
    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: "USER",
      isBanned: false,
    });

    const { markMessagesRead } = await import("../../../src/server/messages/actions");
    vi.mocked(markMessagesRead).mockResolvedValue({ ok: true, data: 2 });

    const { getConversation } = await import("../../../src/server/messages/actions");
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        listing: { select: { id: true, title: true, photoUrls: true, status: true } },
        renter: { select: { id: true, name: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const booking = await prisma.bookingRequest.findFirst({
      where: { listingId: listing.id, renterId: renter.id, status: { in: ["PENDING", "APPROVED", "COMPLETED"] } },
      select: { status: true },
      orderBy: { createdAt: "desc" },
    });
    vi.mocked(getConversation).mockResolvedValue({
      ok: true,
      data: { ...conversation, bookingStatus: booking?.status ?? null },
    });

    const { default: ConversationPage } = await import("../../../src/app/hesap/mesajlar/[id]/page");
    render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }));

    await waitFor(() => {
      expect(markMessagesRead).toHaveBeenCalledWith(conversationId);
    });
  });

  it("üyeliği olmayan kullanıcı 404 görür", async () => {
    const outsider = await prisma.user.create({ data: makeUser({ email: "outsider@test.com" }) });

    const { getSessionUser } = await import("../../../src/lib/auth");
    vi.mocked(getSessionUser).mockResolvedValue({
      id: outsider.id,
      name: outsider.name,
      email: outsider.email,
      role: "USER",
      isBanned: false,
    });

    const { getConversation } = await import("../../../src/server/messages/actions");
    vi.mocked(getConversation).mockResolvedValue({
      ok: false,
      error: "Bu sohbete mesaj gönderme yetkiniz yok.",
    });

    const { default: ConversationPage } = await import("../../../src/app/hesap/mesajlar/[id]/page");
    // notFound throw edecek, test render sırasında hata fırlatır
    await expect(
      render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }))
    ).rejects.toThrow();
  });
});