import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import { openListingFromSearch, settle, waitForHydration } from "./helpers/ui";
import { ACCOUNTS, CHAT_MESSAGE_SCENARIO_4, CITIES, LISTINGS } from "./fixtures/seed-data";

/**
 * Senaryo 4: Kiracı ilandaki "Sor" butonuyla sohbet başlatır ve mesaj gönderir;
 * ilan sahibi mesajı okunmamış olarak görür, sohbeti açtığında mesaj okundu
 * işaretlenir (okunmamış rozeti kaybolur = okundu bilgisi).
 */
test("senaryo 4: kiracı 'Sor' ile mesaj gönderir, sahip görür ve okundu işaretlenir", async ({
  browser,
}) => {
  const message = CHAT_MESSAGE_SCENARIO_4;

  await test.step("kiracı ilandan sohbet başlatır ve mesaj gönderir", async () => {
    const page = await browser.newPage();
    await login(page, ACCOUNTS.renter);
    await openListingFromSearch(page, CITIES.izmir, LISTINGS.izmir);

    await waitForHydration(page.getByRole("button", { name: "Sor" }));
    await page.getByRole("button", { name: "Sor" }).click();
    await expect(page).toHaveURL(/\/hesap\/mesajlar\/[^/]+$/);
    await settle(page);
    await expect(page.getByRole("heading", { level: 1, name: "Sohbet" })).toBeVisible();
    await expect(page.getByText("Henüz mesaj yok.")).toBeVisible();
    await waitForHydration(page.getByRole("log"));

    await page.getByLabel("Mesaj içeriği").fill(message);
    await page.getByRole("button", { name: "Gönder" }).click();

    // Mesaj konuşma akışında (role="log") görünür.
    await expect(page.getByRole("log").getByText(message)).toBeVisible();
    await page.close();
  });

  await test.step("sahip mesajı okunmamış olarak görür ve okundu işaretlenir", async () => {
    const ownerPage = await browser.newPage();
    await login(ownerPage, ACCOUNTS.owner);
    await ownerPage.goto("/hesap/mesajlar");
    await settle(ownerPage);
    await expect(
      ownerPage.getByRole("heading", { level: 1, name: "Mesajlarım" }),
    ).toBeVisible();

    const conversationRow = ownerPage
      .getByRole("listitem")
      .filter({ hasText: LISTINGS.izmir });
    await expect(conversationRow).toHaveCount(1);
    // Son mesaj önizlemesi + okunmamış rozeti.
    await expect(conversationRow.getByText(message)).toBeVisible();
    await expect(conversationRow.getByLabel("1 okunmamış mesaj")).toBeVisible();

    // Sohbet açıldığında mesajlar okundu işaretlenir; sunucu eyleminin
    // tamamlanması beklenip listeye dönülür (sabit bekleme yok).
    const markRead = ownerPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/hesap/mesajlar/"),
    );
    await conversationRow.getByRole("link").click();
    await settle(ownerPage);
    await expect(ownerPage.getByRole("log").getByText(message)).toBeVisible();
    await markRead;

    await ownerPage
      .getByRole("navigation", { name: "Hesap menüsü" })
      .getByRole("link", { name: "Mesajlar" })
      .click();
    await settle(ownerPage);
    await expect(ownerPage.getByRole("heading", { level: 1, name: "Mesajlarım" })).toBeVisible();

    // Okundu bilgisi: aynı sohbet için okunmamış rozeti kalmadı.
    const readRow = ownerPage.getByRole("listitem").filter({ hasText: LISTINGS.izmir });
    await expect(readRow).toHaveCount(1);
    await expect(readRow.getByText(message)).toBeVisible();
    await expect(readRow.getByLabel(/okunmamış mesaj/)).toHaveCount(0);
    await ownerPage.close();
  });
});
