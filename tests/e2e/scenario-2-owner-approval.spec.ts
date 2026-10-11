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
import { ACCOUNTS, BOOKING_MESSAGE_SCENARIO_2, CITIES, LISTINGS } from "./fixtures/seed-data";

/**
 * Senaryo 2: Kiracı talebi gönderir → ilan sahibi onaylar → kiracı hesabında
 * talebin durumunun "Onaylandı" olduğunu görür.
 *
 * Üç farklı oturum gerekir (kiracı / sahip / kiracı); her adım kendi tarayıcı
 * bağlamında çalışır (cookie'ler paylaşılmaz).
 */
test("senaryo 2: sahip talebi onaylar ve kiracı 'Onaylandı' durumunu görür", async ({
  browser,
}) => {
  // Retry-güvenli kimlik: her deneme (ilk + retry) kendi satırını bulur.
  // Mesaj: retry step-1'de ikinci kayıt oluşsa bile step-2 filtresi yalnız bu
  // denemenin satırını eşleştirir (sabit mesaj 2 satır eşleştirip
  // toHaveCount(1)'i patlatıyordu). Tarih: step-3 tarih filtresi de yalnız bu
  // denemenin satırını eşleştirir (giden satırlar mesajı göstermez).
  const attempt = test.info().retry;
  const bookingMessage = `${BOOKING_MESSAGE_SCENARIO_2} #${Date.now()}`;
  // Senaryo 1'in kullandığı aralıktan farklı, gelecekte bir konaklama aralığı.
  // Deneme başına +1 gün kaydırma: retry kendi tarih aralığını kullanır.
  const stay = { start: isoDay(60 + attempt), end: isoDay(63 + attempt), guests: "2" };

  await test.step("kiracı rezervasyon talebi gönderir", async () => {
    const page = await browser.newPage();
    await login(page, ACCOUNTS.renter);
    await openListingFromSearch(page, CITIES.antalya, LISTINGS.antalya);
    await waitForHydration(page.getByRole("heading", { name: "Rezervasyon Talebi" }));

    await fillBookingForm(page, stay, bookingMessage);
    // Hidrasyon koruması: istemci form henüz bağlanmamışken gönderim sessizce
    // kaybolur (senaryo-4'teki "Sor" butonu ile aynı kalıp).
    const submitButton = page.getByRole("button", { name: "Talebi Gönder" });
    await waitForHydration(submitButton);
    await submitButton.click();
    await expect(page.getByText("Talebiniz gönderildi")).toBeVisible();
    await page.close();
  });

  await test.step("ilan sahibi gelen talebi onaylar", async () => {
    const ownerPage = await browser.newPage();
    await login(ownerPage, ACCOUNTS.owner);
    await ownerPage.goto("/hesap/taleplerim");
    await settle(ownerPage);
    await expect(
      ownerPage.getByRole("heading", { level: 1, name: "Taleplerim" }),
    ).toBeVisible();

    // Gelen taleplerde kiracının mesajı gösterilir → satır mesajla bulunur.
    const incoming = sectionByHeading(ownerPage, "Gelen Talepler");
    const row = incoming.getByRole("listitem").filter({ hasText: bookingMessage });
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Bekliyor")).toBeVisible();

    // Hidrasyon koruması: hidrasyon öncesi tıklama sessizce kaybolur, kayıt
    // PENDING kalır (CI'daki birincil arıza). Satır kapsamlı buton koruması.
    const approveButton = row.getByRole("button", { name: "Onayla" });
    await waitForHydration(approveButton);
    await approveButton.click();
    // Onay sonrası satır yeniden render edilir: rozet "Onaylandı" olur.
    // CI'da server action + router.refresh yavaşlayabilir → cömert zaman aşımı.
    await expect(row.getByText("Onaylandı")).toBeVisible({ timeout: 30_000 });
    await ownerPage.close();
  });

  await test.step("kiracı onaylanmış talebi görür", async () => {
    const renterPage = await browser.newPage();
    await login(renterPage, ACCOUNTS.renter);
    await renterPage.goto("/hesap/taleplerim");
    await settle(renterPage);
    await expect(
      renterPage.getByRole("heading", { level: 1, name: "Taleplerim" }),
    ).toBeVisible();

    const outgoing = sectionByHeading(renterPage, "Giden Taleplerim");
    const row = outgoing
      .getByRole("listitem")
      .filter({ hasText: dateRangeLabel(stay.start, stay.end) });
    await expect(row).toHaveCount(1);
    await expect(row.getByText(LISTINGS.antalya)).toBeVisible();
    await expect(row.getByText("Onaylandı")).toBeVisible();
    await renterPage.close();
  });
});
