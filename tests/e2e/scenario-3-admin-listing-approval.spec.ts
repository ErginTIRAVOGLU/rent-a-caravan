import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { sectionByHeading, settle } from "./helpers/ui";
import { ACCOUNTS, CITIES, LISTINGS } from "./fixtures/seed-data";

/**
 * Senaryo 3: Admin "incelemede" (PENDING) bekleyen Bolu ilanını onaylar ve ilan
 * arama sonuçlarında (herkese açık yüzeyde) görünür hâle gelir.
 *
 * Önkoşul (fixtures/prepare-db.ts): her koşumda Bolu ilanı PENDING durumuna
 * döndürülür — admin onayından sonra ACTIVE olur.
 */
test("senaryo 3: admin onay bekleyen ilanı onaylar ve ilan aramada görünür", async ({
  page,
}) => {
  await test.step("onay öncesi ilan aramada görünmez", async () => {
    await page.goto(`/arama?sehir=${encodeURIComponent(CITIES.bolu)}`);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Eşleşen karavan bulunamadı",
    );
    await expect(page.getByText("Sonuç bulunamadı")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: LISTINGS.bolu })).toHaveCount(0);
  });

  await test.step("admin ilanı onaylar", async () => {
    await login(page, ACCOUNTS.admin);
    await page.goto("/admin/ilanlar");
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: "İlanlar" })).toBeVisible();

    const pending = sectionByHeading(page, "İncelemedeki ilanlar");
    const row = pending.getByRole("listitem").filter({ hasText: LISTINGS.bolu });
    await expect(row).toHaveCount(1);
    await expect(row.getByText("İncelemede")).toBeVisible();

    await row.getByRole("button", { name: "Onayla" }).click();

    // Onay sonrası satır inceleme kuyruğundan çıkıp "Yayındaki ilanlar"a geçer.
    await expect(
      pending.getByRole("listitem").filter({ hasText: LISTINGS.bolu }),
    ).toHaveCount(0);
    const active = sectionByHeading(page, "Yayındaki ilanlar");
    await expect(
      active.getByRole("listitem").filter({ hasText: LISTINGS.bolu }),
    ).toHaveCount(1);
    await expect(
      active.getByRole("listitem").filter({ hasText: LISTINGS.bolu }).getByText("Yayında"),
    ).toBeVisible();
  });

  await test.step("admin ilan detay önizlemesini açar", async () => {
    await page.goto("/admin/ilanlar");
    await settle(page);
    const active = sectionByHeading(page, "Yayındaki ilanlar");
    const row = active.getByRole("listitem").filter({ hasText: LISTINGS.bolu });
    await expect(row).toHaveCount(1);
    await row.getByRole("link", { name: "İncele" }).click();
    await settle(page);
    await expect(
      page.getByRole("heading", { level: 1, name: LISTINGS.bolu }),
    ).toBeVisible();
    await expect(page.getByText("Yayında")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "İlan sahibi" }),
    ).toBeVisible();
  });

  await test.step("ilan arama sonucunda ve detayda görünür", async () => {
    await page.goto(`/arama?sehir=${encodeURIComponent(CITIES.bolu)}`);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      `${CITIES.bolu} için 1 karavan bulundu`,
    );

    const card = page.getByRole("listitem").filter({ hasText: LISTINGS.bolu });
    await expect(card).toHaveCount(1);
    await card.getByRole("link").first().click();
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: LISTINGS.bolu })).toBeVisible();
  });
});
