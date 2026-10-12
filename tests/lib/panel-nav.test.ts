import { describe, expect, it } from "vitest";

import {
  accountNavItems,
  adminNavItems,
  isPanelItemActive,
  navBadge,
  type PanelNavItem,
} from "../../src/components/panel/nav";

function findItem(items: PanelNavItem[], href: string): PanelNavItem {
  const item = items.find((candidate) => candidate.href === href);
  if (!item) throw new Error(`öğe bulunamadı: ${href}`);
  return item;
}

describe("navBadge", () => {
  it("0 için undefined döner (rozet gizli)", () => {
    expect(navBadge(0)).toBeUndefined();
  });

  it("negatif değer için undefined döner", () => {
    expect(navBadge(-1)).toBeUndefined();
  });

  it("pozitif değeri olduğu gibi döner", () => {
    expect(navBadge(1)).toBe(1);
    expect(navBadge(42)).toBe(42);
  });
});

describe("accountNavItems", () => {
  const counts = { listings: 3, pendingIncoming: 1, unreadMessages: 0 };

  it("menü sırası ve yolları sabittir", () => {
    const items = accountNavItems(counts);
    expect(items.map((item) => item.href)).toEqual([
      "/hesap",
      "/hesap/ilanlarim",
      "/hesap/taleplerim",
      "/hesap/mesajlar",
      "/hesap/degerlendirmeler",
      "/hesap/profil",
    ]);
    expect(items.map((item) => item.label)).toEqual([
      "Genel Bakış",
      "İlanlarım",
      "Taleplerim",
      "Mesajlar",
      "Değerlendirmeler",
      "Profil",
    ]);
  });

  it("Genel Bakış yalnızca tam eşleşmede aktiftir (exact)", () => {
    const items = accountNavItems(counts);
    expect(findItem(items, "/hesap").exact).toBe(true);
    // Diğer öğeler önek eşleşmesi kullanır (exact değil).
    expect(findItem(items, "/hesap/ilanlarim").exact).toBeUndefined();
  });

  it("rozetleri verilen sayılardan doldurur", () => {
    const items = accountNavItems(counts);
    expect(findItem(items, "/hesap/ilanlarim").badge).toBe(3);
    expect(findItem(items, "/hesap/taleplerim").badge).toBe(1);
  });

  it("0 olan sayaç için rozet üretmez", () => {
    const items = accountNavItems(counts);
    expect(findItem(items, "/hesap/mesajlar").badge).toBeUndefined();
  });
});

describe("adminNavItems", () => {
  const counts = { pendingListings: 5, openReports: 0 };

  it("menü sırası ve yolları sabittir", () => {
    const items = adminNavItems(counts);
    expect(items.map((item) => item.href)).toEqual([
      "/admin",
      "/admin/ilanlar",
      "/admin/kullanicilar",
      "/admin/sikayetler",
      "/admin/ayarlar",
    ]);
  });

  it("Genel Bakış exact, rozetler sayaçlardan gelir ve 0 gizlenir", () => {
    const items = adminNavItems(counts);
    expect(findItem(items, "/admin").exact).toBe(true);
    expect(findItem(items, "/admin/ilanlar").badge).toBe(5);
    expect(findItem(items, "/admin/sikayetler").badge).toBeUndefined();
  });
});

describe("isPanelItemActive", () => {
  const account = accountNavItems({
    listings: 0,
    pendingIncoming: 0,
    unreadMessages: 0,
  });

  it("alt yolda önek öğesi aktif olur", () => {
    expect(
      isPanelItemActive("/hesap/ilanlarim/yeni", findItem(account, "/hesap/ilanlarim")),
    ).toBe(true);
  });

  it("önek öğesi tam yolda da aktif olur", () => {
    expect(
      isPanelItemActive("/hesap/ilanlarim", findItem(account, "/hesap/ilanlarim")),
    ).toBe(true);
  });

  it("exact öğe yalnızca tam yolda aktif, alt yolda pasiftir", () => {
    const genelBakis = findItem(account, "/hesap");
    expect(isPanelItemActive("/hesap", genelBakis)).toBe(true);
    expect(isPanelItemActive("/hesap/foo", genelBakis)).toBe(false);
  });

  it("önek tuzağına düşmez (/hesap/ilanlarimx pasif)", () => {
    expect(
      isPanelItemActive("/hesap/ilanlarimx", findItem(account, "/hesap/ilanlarim")),
    ).toBe(false);
  });

  it("ilgisiz yol pasiftir", () => {
    expect(
      isPanelItemActive("/admin/ilanlar", findItem(account, "/hesap/ilanlarim")),
    ).toBe(false);
  });
});
