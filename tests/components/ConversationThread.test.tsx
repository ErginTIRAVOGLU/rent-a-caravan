/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Message } from "@prisma/client";

const { mockConversation, mutateMock, sendMessageMock, markReadMock } =
  vi.hoisted(() => ({
    mockConversation: { value: null as unknown },
    mutateMock: vi.fn(),
    sendMessageMock: vi.fn(),
    markReadMock: vi.fn(),
  }));

vi.mock("swr", () => ({
  default: () => ({
    data: (mockConversation as { value: unknown }).value,
    mutate: mutateMock,
  }),
}));

vi.mock("../../src/server/messages/actions", () => ({
  sendMessage: sendMessageMock,
  markMessagesRead: markReadMock,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { ConversationThread } from "../../src/app/hesap/mesajlar/[id]/ConversationThread";

const RENTER_ID = "renter-1";
const OWNER_ID = "owner-1";
const CONV_ID = "conv-1";

type ThreadMessage = Message & {
  sender: { id: string; name: string; avatarUrl: string | null };
};

function makeMessage(
  id: string,
  senderId: string,
  content: string,
  createdAt: Date,
): ThreadMessage {
  return {
    id,
    conversationId: CONV_ID,
    senderId,
    content,
    readAt: null,
    createdAt,
    sender: {
      id: senderId,
      name: senderId === RENTER_ID ? "Kiracı" : "Sahip",
      avatarUrl: null,
    },
  };
}

function makeConversation(messages: ThreadMessage[]) {
  return {
    id: CONV_ID,
    listingId: "listing-1",
    renterId: RENTER_ID,
    ownerId: OWNER_ID,
    lastMessageAt: null,
    lastMessagePreview: null,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    listing: { id: "listing-1", title: "Test İlanı", photoUrls: [], status: "ACTIVE" },
    renter: { id: RENTER_ID, name: "Kiracı", avatarUrl: null },
    owner: { id: OWNER_ID, name: "Sahip", avatarUrl: null },
    messages,
    bookingStatus: null,
  };
}

const scrollSpy = vi.fn();

describe("ConversationThread scroll + optimistic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scrollSpy.mockClear();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    markReadMock.mockResolvedValue({ ok: true, data: 0 });
    sendMessageMock.mockResolvedValue({
      ok: true,
      data: {
        id: "server-1",
        conversationId: CONV_ID,
        senderId: RENTER_ID,
        content: "Yeni mesaj",
        readAt: null,
        createdAt: new Date("2026-01-01T10:03:00Z"),
      },
    });
    mutateMock.mockResolvedValue(undefined);
  });

  function setup(messages: ThreadMessage[]) {
    mockConversation.value = makeConversation(messages);
    return render(
      <ConversationThread
        initialConversation={makeConversation(messages)}
        currentUserId={RENTER_ID}
      />,
    );
  }

  function setScrollState(el: HTMLElement, state: { scrollHeight: number; scrollTop: number; clientHeight: number }) {
    Object.defineProperty(el, "scrollHeight", { value: state.scrollHeight, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: state.clientHeight, configurable: true });
    el.scrollTop = state.scrollTop;
  }

  it("ilk yüklemede alta kaydırmaz (thread üstten açılır)", () => {
    setup([makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))]);

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("poll güncellemesi yukarıda okuyan kullanıcıyı alta çekmez", () => {
    const first = [makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))];
    const { rerender } = setup(first);
    expect(scrollSpy).not.toHaveBeenCalled();

    // Kullanıcı yukarıda: 1500px kala.
    const log = screen.getByRole("log");
    setScrollState(log, { scrollHeight: 2000, scrollTop: 0, clientHeight: 500 });

    // Poll yeni mesaj getirdi.
    const updated = [
      ...first,
      makeMessage("m2", OWNER_ID, "Orada mısınız?", new Date("2026-01-01T10:02:00Z")),
    ];
    mockConversation.value = makeConversation(updated);
    rerender(
      <ConversationThread
        initialConversation={makeConversation(updated)}
        currentUserId={RENTER_ID}
      />,
    );

    expect(screen.getByText("Orada mısınız?")).toBeInTheDocument();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("alta yakınken gelen poll mesajında alta kaydırır", () => {
    const first = [makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))];
    const { rerender } = setup(first);
    expect(scrollSpy).not.toHaveBeenCalled();

    // Kullanıcı altta: 50px kala.
    const log = screen.getByRole("log");
    setScrollState(log, { scrollHeight: 2000, scrollTop: 1450, clientHeight: 500 });

    const updated = [
      ...first,
      makeMessage("m2", OWNER_ID, "Yeni bilgi", new Date("2026-01-01T10:02:00Z")),
    ];
    mockConversation.value = makeConversation(updated);
    rerender(
      <ConversationThread
        initialConversation={makeConversation(updated)}
        currentUserId={RENTER_ID}
      />,
    );

    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("gönderilen mesaj revalidation bitene kadar görünür kalır (boşluk yok)", async () => {
    setup([makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))]);

    const input = screen.getByPlaceholderText("Mesajınızı yazın…");
    fireEvent.change(input, { target: { value: "Yeni mesaj" } });
    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    // Optimistic görünür.
    await waitFor(() => {
      expect(screen.getByText("Yeni mesaj")).toBeInTheDocument();
    });
    // Sunucu onayı + revalidation sonrası hâlâ görünür (eski kod siliyordu).
    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
    });
    expect(screen.getByText("Yeni mesaj")).toBeInTheDocument();
  });

  it("gönderim başarısında mesaj revalidation beklenmeden rozetsiz görünür", async () => {
    // mutate asla çözülmese bile mesaj rozetsiz görünür (deterministik swap).
    mutateMock.mockReturnValueOnce(new Promise(() => {}));
    setup([makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))]);

    const input = screen.getByPlaceholderText("Mesajınızı yazın…");
    fireEvent.change(input, { target: { value: "Yeni mesaj" } });
    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Yeni mesaj")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByText(/gönderiliyor/)).not.toBeInTheDocument();
    });
  });

  it("gönderim hatasında optimistic mesaj silinir ve Türkçe hata gösterilir", async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: false, error: "Gönderilemedi." });
    setup([makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))]);

    const input = screen.getByPlaceholderText("Mesajınızı yazın…");
    fireEvent.change(input, { target: { value: "Yeni mesaj" } });
    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Gönderilemedi.");
    });
    expect(screen.queryByText("Yeni mesaj")).not.toBeInTheDocument();
  });

  it("sunucu yankısı gelince optimistic tekilleşir (çift görünmez)", async () => {
    const { rerender } = setup([makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z"))]);

    const input = screen.getByPlaceholderText("Mesajınızı yazın…");
    fireEvent.change(input, { target: { value: "Yeni mesaj" } });
    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Yeni mesaj")).toBeInTheDocument();
    });

    // Sunucu yankısı poll ile geldi.
    const echoed = [
      makeMessage("m1", OWNER_ID, "Merhaba", new Date("2026-01-01T10:01:00Z")),
      makeMessage("server-1", RENTER_ID, "Yeni mesaj", new Date()),
    ];
    mockConversation.value = makeConversation(echoed);
    rerender(
      <ConversationThread
        initialConversation={makeConversation(echoed)}
        currentUserId={RENTER_ID}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Yeni mesaj")).toHaveLength(1);
    });
  });
});
