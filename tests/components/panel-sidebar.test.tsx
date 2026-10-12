/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import type { PanelNavItem } from "../../src/components/panel/nav";

// Mock next/link — PanelSidebar/PanelShell bağımlılığı.
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation — pathname değiştirilebilir.
const mockPathname = vi.fn(() => "/hesap/ilanlarim");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// PanelTopbar bağımlılıkları (PanelShell render'ı için).
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
  default: () => ({ data: 0, error: undefined, isLoading: false, mutate: vi.fn() }),
}));

import { PanelSidebar } from "../../src/components/panel/PanelSidebar";
import { PanelShell } from "../../src/components/panel/PanelShell";

const ITEMS: PanelNavItem[] = [
  { href: "/hesap", label: "Genel Bakış", icon: "dashboard", exact: true },
  { href: "/hesap/ilanlarim", label: "İlanlarım", icon: "rv_hookup", badge: 3 },
  { href: "/hesap/mesajlar", label: "Mesajlar", icon: "chat_bubble" },
];

describe("PanelSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/hesap/ilanlarim");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("aktif öğeyi aria-current=\"page\" ile işaretler", () => {
    render(<PanelSidebar items={ITEMS} />);

    const active = screen.getByRole("link", { name: /İlanlarım/ });
    expect(active).toHaveAttribute("aria-current", "page");

    const pasif = screen.getByRole("link", { name: /Genel Bakış/ });
    expect(pasif).not.toHaveAttribute("aria-current");
  });

  it("rozetli öğede sayıyı gösterir", () => {
    render(<PanelSidebar items={ITEMS} />);

    expect(screen.getByTestId("nav-badge-/hesap/ilanlarim")).toHaveTextContent("3");
  });

  it("rozeti olmayan öğede sayı göstermez", () => {
    render(<PanelSidebar items={ITEMS} />);

    expect(screen.queryByTestId("nav-badge-/hesap/mesajlar")).toBeNull();
  });

  it("exact olmayan alt yol aktif öğeyi doğru seçer", () => {
    mockPathname.mockReturnValue("/hesap/ilanlarim/yeni");
    render(<PanelSidebar items={ITEMS} />);

    expect(screen.getByRole("link", { name: /İlanlarım/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Genel Bakış/ })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("PanelShell offcanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/hesap/ilanlarim");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("tetikleyicide aria-expanded ve aria-controls bulunur", () => {
    render(
      <PanelShell items={ITEMS}>
        <p>içerik</p>
      </PanelShell>,
    );

    const trigger = screen.getByRole("button", { name: "Menü" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).not.toBeNull();
  });

  it("hamburger ile açılır, Escape ile kapanır", () => {
    render(
      <PanelShell items={ITEMS}>
        <p>içerik</p>
      </PanelShell>,
    );

    const trigger = screen.getByRole("button", { name: "Menü" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("rota değişiminde offcanvas kapanır", () => {
    const { rerender } = render(
      <PanelShell items={ITEMS}>
        <p>içerik</p>
      </PanelShell>,
    );

    const trigger = screen.getByRole("button", { name: "Menü" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    mockPathname.mockReturnValue("/hesap/mesajlar");
    rerender(
      <PanelShell items={ITEMS}>
        <p>içerik</p>
      </PanelShell>,
    );

    expect(screen.getByRole("button", { name: "Menü" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("PanelShell offcanvas erişilebilirliği (mobil)", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/hesap/ilanlarim");
    // Mobil kırılım: lg eşleşmez.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(min-width: 1024px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.resetAllMocks();
  });

  it("kapalı offcanvas kenar çubuğunu erişilebilirlik ağacından ve sekme sırasından çıkarır", () => {
    render(
      <PanelShell items={ITEMS}>
        <p>içerik</p>
      </PanelShell>,
    );

    const drawer = document.getElementById("panel-sidebar");
    expect(drawer).not.toBeNull();
    expect(drawer).toHaveAttribute("aria-hidden", "true");
    expect(drawer).toHaveAttribute("inert");

    const trigger = screen.getByRole("button", { name: "Menü" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(drawer).not.toHaveAttribute("aria-hidden");
    expect(drawer).not.toHaveAttribute("inert");
  });
});
