import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

import { prisma } from "../../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../../helpers/db";
import {
  getConversation,
  sendMessage,
  markMessagesRead,
} from "../../../../src/server/messages/actions";

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
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/hesap/mesajlar/test-id",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

// Mock messages actions module
vi.mock("../../../../src/server/messages/actions", () => ({
  getConversation: vi.fn(),
  sendMessage: vi.fn(),
  markMessagesRead: vi.fn(),
}));

// jsdom setup
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" });
global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.self = dom.window as unknown as Window & typeof globalThis;
// Node.js 21+ global.navigator salt okunur — defineProperty ile override.
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  writable: true,
  configurable: true,
});
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
// jsdom doesn't implement scrollIntoView
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
// jsdom FormData constructor doesn't accept undefined (event.currentTarget can be undefined)
vi.stubGlobal(
  "FormData",
  class {
    private data = new Map<string, string>();
    constructor(form?: unknown) {
      if (form instanceof dom.window.HTMLFormElement) {
        const input = form.querySelector('input[name="content"]');
        if (input) {
          this.data.set("content", (input as HTMLInputElement).value);
        }
      }
    }
    get(name: string) {
      return this.data.get(name) ?? null;
    }
    append(name: string, value: string) {
      this.data.set(name, String(value));
    }
  },
);

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  // Default: markMessagesRead returns a resolved Promise (component calls .catch)
  vi.mocked(markMessagesRead).mockResolvedValue({ ok: true, data: 0 });
});

afterEach(() => {
  vi.useRealTimers();
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
    setupSession(renter);

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

    const { default: ConversationPage } = await import("../../../../src/app/hesap/mesajlar/[id]/page");
    const { getByText } = render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }));

    expect(getByText("Test İlanı")).toBeInTheDocument();
    expect(getByText("Merhaba")).toBeInTheDocument();
    expect(getByText("Merhaba, nasıl yardımcı olabilirim?")).toBeInTheDocument();
  });

  it("mesaj gönderimi optimistic UI günceller", async () => {
    setupSession(renter);

    vi.mocked(sendMessage).mockResolvedValue({ ok: true, data: { id: "new-msg", conversationId, senderId: renter.id, content: "Yeni mesaj", readAt: null, createdAt: new Date() } });

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

    const { default: ConversationPage } = await import("../../../../src/app/hesap/mesajlar/[id]/page");
    const { getByText, getByPlaceholderText } = render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }));

    // Mesaj yaz ve gönder
    const input = getByPlaceholderText("Mesajınızı yazın…");
    fireEvent.change(input, { target: { value: "Yeni mesaj" } });
    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    // Optimistic mesaj görünmeli
    await waitFor(() => {
      expect(getByText("Yeni mesaj")).toBeInTheDocument();
    });
  });

  it("sohbet açıldığında mesajlar okundu işaretlenir (markMessagesRead çağrılır)", async () => {
    setupSession(owner);

    vi.mocked(markMessagesRead).mockResolvedValue({ ok: true, data: 2 });

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

    const { default: ConversationPage } = await import("../../../../src/app/hesap/mesajlar/[id]/page");
    render(await ConversationPage({ params: Promise.resolve({ id: conversationId }) }));

    await waitFor(() => {
      expect(markMessagesRead).toHaveBeenCalledWith(conversationId);
    });
  });

  it("üyeliği olmayan kullanıcı 404 görür", async () => {
    const outsider = await prisma.user.create({ data: makeUser({ email: "outsider@test.com" }) });

    setupSession(outsider);

    const { getConversation } = await import("../../../../src/server/messages/actions");
    vi.mocked(getConversation).mockResolvedValue({
      ok: false,
      error: "Bu sohbete mesaj gönderme yetkiniz yok.",
    });

    const { default: ConversationPage } = await import("../../../../src/app/hesap/mesajlar/[id]/page");
    // notFound throw edecek, test render sırasında hata fırlatır
    await expect(async () => {
      const page = await ConversationPage({ params: Promise.resolve({ id: conversationId }) });
      render(page);
    }).rejects.toThrow();
  });
});
