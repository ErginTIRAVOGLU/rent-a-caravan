/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

// Mock next/link (SiteHeader/SiteFooter bağımlılığı)
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation pathname (değiştirilebilir)
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock next-auth/react (SiteHeader `useSession` bağımlılığı)
const mockUpdate = vi.fn();
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useSession: () => ({
    data: null,
    status: "unauthenticated",
    update: mockUpdate,
  }),
}));

// Mock swr (SiteHeader okunmamış mesaj sayacı bağımlılığı)
vi.mock("swr", () => ({
  default: () => ({
    data: 0,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

// Mock auth-actions (SiteHeader `signOutAction` bağımlılığı)
vi.mock("../../src/lib/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

// Mock next/image (SiteFooter logo bağımlılığı)
vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img">) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

// Import after mocks
import { ChromeGate, isPanelPath } from "../../src/components/ChromeGate";

describe("ChromeGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("panel rotalarında site header/footer gizlenir", () => {
    mockPathname.mockReturnValue("/hesap/taleplerim");
    const { queryByTestId } = render(
      <ChromeGate>
        <p data-testid="panel">panel</p>
      </ChromeGate>,
    );
    expect(queryByTestId("site-header")).toBeNull();
    expect(queryByTestId("site-footer")).toBeNull();
    expect(queryByTestId("panel")?.textContent).toBe("panel");
  });

  it("panel olmayan rotalarda site header/footer görünür", () => {
    mockPathname.mockReturnValue("/arama");
    const { queryByTestId } = render(
      <ChromeGate>
        <p data-testid="panel">içerik</p>
      </ChromeGate>,
    );
    expect(queryByTestId("site-header")).not.toBeNull();
    expect(queryByTestId("site-footer")).not.toBeNull();
    expect(queryByTestId("panel")?.textContent).toBe("içerik");
  });

  it("isPanelPath sınır durumları", () => {
    expect(isPanelPath("/hesap")).toBe(true);
    expect(isPanelPath("/hesap/taleplerim")).toBe(true);
    expect(isPanelPath("/admin")).toBe(true);
    expect(isPanelPath("/admin/ilanlar")).toBe(true);
    expect(isPanelPath("/hesaplar")).toBe(false); // önek tuzağı
    expect(isPanelPath("/adminlar")).toBe(false);
    expect(isPanelPath("/")).toBe(false);
  });
});
