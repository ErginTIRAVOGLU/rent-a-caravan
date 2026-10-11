/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SessionUser } from "../../src/server/users/service";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt} {...props} data-testid="logo-image" />
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props} data-testid={`link-${href}`}>
      {children}
    </a>
  ),
}));

// Mock next-auth/react completely
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}));

// Mock swr
const mockSWR = vi.fn();
vi.mock("swr", () => ({
  default: (key: string) => mockSWR(key),
}));

// Mock auth-actions
vi.mock("../../src/lib/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

// Import after mocks
import { SiteHeader } from "../../src/components/SiteHeader";
import { signOutAction } from "../../src/lib/auth-actions";

const mockSignOutAction = vi.mocked(signOutAction);

function renderHeader(session?: SessionUser | null, unreadCount?: number) {
  mockUseSession.mockReturnValue({
    data: session ? { user: session } : null,
    status: session ? "authenticated" : "unauthenticated",
    update: vi.fn(),
  });

  mockSWR.mockReturnValue({
    data: unreadCount ?? 0,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  });

  mockSignOutAction.mockResolvedValue(undefined);

  return render(<SiteHeader />);
}

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders logo and brand name", () => {
    renderHeader();

    expect(screen.getByTestId("logo-image")).toBeInTheDocument();
    expect(screen.getByText("Karavan Kiralama")).toBeInTheDocument();
  });

  it("shows login and register links when unauthenticated", () => {
    renderHeader(null);

    expect(screen.getByRole("link", { name: "Giriş Yap" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kayıt Ol" })).toBeInTheDocument();
  });

  it("shows user avatar and dropdown when authenticated", () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user);

    expect(screen.getByText("T")).toBeInTheDocument(); // Initials
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("shows admin link for admin users", () => {
    const adminUser: SessionUser = {
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
      role: "ADMIN",
      isBanned: false,
    };
    renderHeader(adminUser);

    expect(screen.getByRole("link", { name: /admin/i })).toBeInTheDocument();
  });

  it("does not show admin link for regular users", () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user);

    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows unread message badge when count > 0", () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user, 3);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show unread message badge when count is 0", () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user, 0);

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls signOutAction when logout button is clicked", async () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user);

    const logoutButton = screen.getByRole("button", { name: /çıkış/i });
    await logoutButton.click();

    expect(mockSignOutAction).toHaveBeenCalled();
  });

  it("shows loading state while session is loading", () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: "loading",
      update: vi.fn(),
    });

    mockSWR.mockReturnValue({
      data: 0,
      error: undefined,
      isLoading: true,
      mutate: vi.fn(),
    });

    render(<SiteHeader />);

    expect(screen.getByTestId("logo-image")).toBeInTheDocument();
  });

  it("shows navigation links", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Karavanları Keşfet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nasıl Çalışır?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Karavanını Kirala" })).toBeInTheDocument();
  });

  it("shows user menu items in dropdown", () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user);

    const userButton = screen.getByText("Test User").closest("summary");
    if (userButton) {
      userButton.click();
    }

    expect(screen.getByRole("link", { name: /taleplerim/i })).toBeInTheDocument();
    expect(screen.getByTestId("link-/hesap/ilanlarim")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profil/i })).toBeInTheDocument();
  });

  it("İlanlarım menü ikonu geçerli Material Symbols glyph'i kullanır", () => {
    const user: SessionUser = {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      isBanned: false,
    };
    renderHeader(user);

    const link = screen.getByTestId("link-/hesap/ilanlarim");
    expect(
      link.querySelector(".material-symbols-outlined")?.textContent,
    ).toBe("rv_hookup");
  });
});