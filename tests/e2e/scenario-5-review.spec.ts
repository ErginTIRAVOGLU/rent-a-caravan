import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { listingHrefFromSearch, sectionByHeading, settle, waitForHydration } from "./helpers/ui";
import { ACCOUNTS, CITIES, LISTINGS, REVIEW_COMMENT_SCENARIO_5 } from "./fixtures/seed-data";

/**
 * Senaryo 5: Tamamlanmış rezervasyonu olan kiracı ilana puan + yorum yazar;
 * yorum ilan detay sayfasında ve ortalama puan satırında görünür.
 *
 * Önkoşul (fixtures/prepare-db.ts): İzmir ilanında kiracıya ait, yorumu
 * yazılmamış COMPLETED bir rezervasyon upsert edilir. Seed'in COMPLETED
 * kaydı için zaten yorum yazıldığı için ayrı fixture gereklidir.
 */
test("senaryo 5: kiracı tamamlanmış rezervasyonuna yorum yazar ve yorum ilanda görünür", async ({
  page,
}) => {
  const me = ACCOUNTS.renter;
  let listingPath = "";

  await login(page, me);

  await test.step("yorum yazma sayfası açılır", async () => {
    listingPath = await listingHrefFromSearch(page, CITIES.izmir, LISTINGS.izmir);
    await page.goto(`${listingPath}/yorum-yaz`);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: LISTINGS.izmir })).toBeVisible();
    // Puan widget'ı tekil ve görünür olunca form kullanıma hazır.
    await waitForHydration(page.getByRole("radiogroup", { name: "Puan seçin" }));
  });

  await test.step("puan ve yorum gönderilir", async () => {
    await page.getByRole("button", { name: "4 yıldız" }).click();
    await page.getByLabel("Yorumunuz (opsiyonel)").fill(REVIEW_COMMENT_SCENARIO_5);
    await page.getByRole("button", { name: "Yorumu Gönder" }).click();

    // Başarıda değerlendirmeler sayfasına yönlendirilir.
    await expect(page).toHaveURL(/\/hesap\/degerlendirmeler$/);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: "Değerlendirmeler" })).toBeVisible();
    await expect(
      sectionByHeading(page, "Yazdıklarım").getByText(REVIEW_COMMENT_SCENARIO_5),
    ).toBeVisible();
  });

  await test.step("yorum ilan detayında ve ortalamada görünür", async () => {
    await page.goto(listingPath);
    await settle(page);
    const reviews = sectionByHeading(page, "Yorumlar");
    await expect(reviews.getByText(REVIEW_COMMENT_SCENARIO_5)).toBeVisible();
    // Kiracının adı yorumun yazarı olarak görünür.
    await expect(reviews.getByText(me.name)).toBeVisible();
    // Ortalama puan satırı: 4.0 / 5 (1 yorum).
    await expect(reviews.getByText(/4\.0 \/ 5/)).toBeVisible();
    await expect(reviews.getByText(/1 yorum/)).toBeVisible();
  });
});
