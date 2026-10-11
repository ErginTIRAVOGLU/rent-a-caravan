import type { Page } from "@playwright/test";

import type { Account } from "../fixtures/seed-data";
import { PASSWORD } from "../fixtures/seed-data";
import { settle } from "./ui";

/** E-posta + şifre ile giriş; oturum kurulunca döner. */
export async function login(page: Page, account: Account): Promise<void> {
  await page.goto("/giris");
  await settle(page);
  await page.getByLabel("E-posta").fill(account.email);
  await page.getByLabel("Şifre").fill(PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  // Auth.js başarılı girişte yönlendirir; /giris dışına çıkınca oturum vardır
  // (hatalı şifrede URL değişmez → test bu adımda zaman aşımına uğar).
  await page.waitForURL((url) => !url.pathname.startsWith("/giris"));
  await settle(page);
}
