import { describe, expect, it } from "vitest";

import { parseTabValue, tabHref } from "../../src/components/panel/tabs";

const ALLOWED = ["all", "DRAFT", "PENDING", "ACTIVE", "PAUSED", "REJECTED"];

describe("parseTabValue", () => {
  it("tanımsız değer için fallback döner", () => {
    expect(parseTabValue(undefined, ALLOWED, "all")).toBe("all");
  });

  it("boş metin için fallback döner", () => {
    expect(parseTabValue("", ALLOWED, "all")).toBe("all");
  });

  it("izinli değeri olduğu gibi döner", () => {
    expect(parseTabValue("ACTIVE", ALLOWED, "all")).toBe("ACTIVE");
  });

  it("izin verilmeyen değer için fallback döner", () => {
    expect(parseTabValue("gecersiz", ALLOWED, "all")).toBe("all");
  });

  it("çok değerli dizi için fallback döner", () => {
    expect(parseTabValue(["PAUSED", "ACTIVE"], ALLOWED, "all")).toBe("all");
  });

  it("dizinin ilk değeri geçersizse de fallback döner", () => {
    expect(parseTabValue(["gecersiz", "ACTIVE"], ALLOWED, "all")).toBe("all");
  });

  it("boş dizi için fallback döner", () => {
    expect(parseTabValue([], ALLOWED, "all")).toBe("all");
  });
});

describe("tabHref", () => {
  it("diğer query parametrelerini korur, yalnız ilgili parametreyi değiştirir", () => {
    expect(
      tabHref("/hesap/ilanlarim", { q: "ege", durum: "active" }, "durum", "paused"),
    ).toBe("/hesap/ilanlarim?q=ege&durum=paused");
  });

  it("boş değer ilgili parametreyi düşürür (varsayılan sekme)", () => {
    expect(
      tabHref("/hesap/ilanlarim", { q: "ege", durum: "active" }, "durum", ""),
    ).toBe("/hesap/ilanlarim?q=ege");
  });

  it("başka parametre yokken parametreyi tümüyle kaldırır", () => {
    expect(tabHref("/hesap/ilanlarim", { durum: "active" }, "durum", "")).toBe(
      "/hesap/ilanlarim",
    );
  });

  it("query yokken yeni parametre ekler", () => {
    expect(tabHref("/hesap/ilanlarim", {}, "durum", "ACTIVE")).toBe(
      "/hesap/ilanlarim?durum=ACTIVE",
    );
  });

  it("URLSearchParams girdisini kabul eder ve değeri değiştirir", () => {
    const params = new URLSearchParams("q=ege&durum=active");
    expect(tabHref("/hesap/ilanlarim", params, "durum", "PAUSED")).toBe(
      "/hesap/ilanlarim?q=ege&durum=PAUSED",
    );
  });

  it("query parametrelerini URL-güvenli biçimde kodlar", () => {
    expect(tabHref("/hesap/ilanlarim", { q: "a b" }, "durum", "ACTIVE")).toBe(
      "/hesap/ilanlarim?q=a+b&durum=ACTIVE",
    );
  });

  it("tanımsız değerli kayıt alanlarını yok sayar", () => {
    expect(
      tabHref("/hesap/ilanlarim", { q: undefined, durum: "ACTIVE" }, "sekme", "outgoing"),
    ).toBe("/hesap/ilanlarim?durum=ACTIVE&sekme=outgoing");
  });
});
