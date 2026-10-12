import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { ACCOUNTS } from "./fixtures/seed-data";

/**
 * Çıkış regresyonu: sunucu aksiyonu + `redirect`, istemci router cache'i
 * yüzünden hedef sayfayı ESKİ (girişli) layout'la render edebiliyordu; kullanıcı
 * ilk tıklamada ana sayfaya gidip "çıkmamış" görünüyor, ikinci tıklama
 * gerekiyordu. Çözüm: istemci tarafı `signOut` (tam sayfa yönlendirme).
 *
 * Bu testler ilk tıklamada oturumun kapandığını ve başlığın tazelendiğini
 * doğrular — ek yenileme olmadan.
 */

async function openAccountMenuAndSignOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Hesap menüsü" }).click();
  await page.getByRole("button", { name: /çıkış/i }).click();
  // Tam sayfa yönlendirme: "/"e düşer.
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20000 });
}

async function expectLoggedOut(page: import("@playwright/test").Page) {
  // Başlık (banner) kapsamı: footer'da da "Giriş Yap" linki var — genel rol
  // sorgusu iki eşleşme üretir (strict mode).
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Giriş Yap", exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "Kayıt Ol", exact: true })).toBeVisible();
  // Girişli başlık göstergeleri tamamen kaybolmalı (bayat layout yok).
  await expect(page.getByRole("button", { name: "Hesap menüsü" })).toHaveCount(0);
  const session = await page.evaluate(async () => {
    const res = await fetch("/api/auth/session");
    return res.ok ? await res.json() : null;
  });
  expect(session).toBeNull();
}

test("çıkış (panel): ilk tıklamada oturum kapanır ve başlık tazelenir", async ({
  page,
}) => {
  await login(page, ACCOUNTS.admin);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Genel Bakış" }),
  ).toBeVisible();

  await openAccountMenuAndSignOut(page);
  await expectLoggedOut(page);
});

test("çıkış (genel başlık): ilk tıklamada oturum kapanır", async ({ page }) => {
  await login(page, ACCOUNTS.renter);
  await page.goto("/arama");
  await expect(page.getByRole("button", { name: "Hesap menüsü" })).toBeVisible();

  await openAccountMenuAndSignOut(page);
  await expectLoggedOut(page);
});
