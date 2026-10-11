import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import {
  dateRangeLabel,
  fillBookingForm,
  isoDay,
  openListingFromSearch,
  sectionByHeading,
  settle,
  waitForHydration,
} from "./helpers/ui";
import { ACCOUNTS, BOOKING_MESSAGE_SCENARIO_1, CITIES, LISTINGS } from "./fixtures/seed-data";

/**
 * Senaryo 1: Kiracı aramadan ilan bulur, rezervasyon talebi gönderir ve
 * hesabındaki "Giden Taleplerim" listesinde talebi "Bekliyor" olarak görür.
 *
 * Not: "Giden Taleplerim" satırında kiracının kendi mesajı gösterilmez (yalnız
 * gelen taleplerde mesaj rozetlenir), bu yüzden satır tarih aralığıyla bulunur.
 */
test("senaryo 1: kiracı ilan bulur, talep gönderir ve 'Bekliyor' durumunu görür", async ({
  page,
}) => {
  // Çakışma olmayan, gelecekte bir konaklama aralığı.
  const stay = { start: isoDay(45), end: isoDay(48), guests: "2" };

  await login(page, ACCOUNTS.renter);

  await test.step("arama sonucundan İzmir ilanı açılır", async () => {
    await openListingFromSearch(page, CITIES.izmir, LISTINGS.izmir);
    await waitForHydration(page.getByRole("heading", { name: "Rezervasyon Talebi" }));
  });

  await test.step("rezervasyon talebi gönderilir", async () => {
    await fillBookingForm(page, stay, BOOKING_MESSAGE_SCENARIO_1);
    // Tarih/kişi geçerli olunca istemci tahmini toplamı gösterir.
    await expect(page.getByText("Tahmini toplam:")).toBeVisible();

    await page.getByRole("button", { name: "Talebi Gönder" }).click();
    await expect(page.getByText("Talebiniz gönderildi")).toBeVisible();
  });

  await test.step("hesapta talep 'Bekliyor' olarak listelenir", async () => {
    await page.getByRole("link", { name: /Taleplerinizi görüntüleyin/ }).click();
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: "Taleplerim" })).toBeVisible();

    const outgoing = sectionByHeading(page, "Giden Taleplerim");
    const row = outgoing
      .getByRole("listitem")
      .filter({ hasText: dateRangeLabel(stay.start, stay.end) });
    // Konaklama aralığı kiracının diğer taleplerinden farklı → tek satır.
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Bekliyor")).toBeVisible();
    await expect(row.getByText(LISTINGS.izmir)).toBeVisible();
  });
});
