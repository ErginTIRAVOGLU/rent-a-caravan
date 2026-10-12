import { expect, test } from "@playwright/test";

import { login } from "./helpers/auth";
import {
  dataTable,
  dateRangeLabel,
  expectActiveTab,
  expectSameDocument,
  fillBookingForm,
  isoDay,
  markDocument,
  openListingFromSearch,
  panelNav,
  sectionByHeading,
  settle,
  tableRow,
  waitForHydration,
} from "./helpers/ui";
import { ACCOUNTS, CITIES, LISTINGS } from "./fixtures/seed-data";

/**
 * Senaryo 6: Ortak `/hesap` paneli — sidebar + stat kartları, durum/sekmelerin
 * URL query'siyle derin bağlanması ve Genel Bakış'taki satır içi onayın tam
 * sayfa yüklemesi OLMADAN durum rozetini güncellemesi (tasarım §10, §12).
 *
 * Fixture'lar yalnız genel önkoşulları hazırlar; bu senaryo kendi "onay
 * bekleyen" talebini üretir, böylece tek başına da (grep) yeşil koşar.
 */

/** `/hesap` sidebar menü öğeleri (tasarım §6). */
const SIDEBAR_ITEMS = [
  "Genel Bakış",
  "İlanlarım",
  "Taleplerim",
  "Mesajlar",
  "Değerlendirmeler",
  "Profil",
];

/** `/hesap` Genel Bakış stat kartı etiketleri (tasarım §8). */
const STAT_LABELS = [
  "Yayında ilan",
  "Bekleyen talep",
  "Okunmamış mesaj",
  "Ortalama puan",
];

test("senaryo 6: panel kabuğu, sekme derin bağlantıları ve satır içi onay", async ({
  browser,
}) => {
  // Retry-güvenli tarih aralığı: her deneme çakışmayan kendi aralığını kullanır.
  const attempt = test.info().retry;
  const stay = {
    start: isoDay(120 + attempt * 4),
    end: isoDay(123 + attempt * 4),
    guests: "2",
  };

  await test.step("kiracı onay bekleyen bir talep oluşturur", async () => {
    const renterPage = await browser.newPage();
    await login(renterPage, ACCOUNTS.renter);
    await openListingFromSearch(renterPage, CITIES.antalya, LISTINGS.antalya);
    await waitForHydration(
      renterPage.getByRole("heading", { name: "Rezervasyon Talebi" }),
    );
    await fillBookingForm(renterPage, stay);
    const submit = renterPage.getByRole("button", { name: "Talebi Gönder" });
    await waitForHydration(submit);
    await submit.click();
    await expect(renterPage.getByText("Talebiniz gönderildi")).toBeVisible();
    await renterPage.close();
  });

  const page = await browser.newPage();
  await login(page, ACCOUNTS.owner);

  await test.step("/hesap Genel Bakış kabuğu: sidebar ve stat kartları", async () => {
    await page.goto("/hesap");
    await settle(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Genel Bakış" }),
    ).toBeVisible();

    const nav = panelNav(page, "Hesap menüsü");
    await expect(nav).toBeVisible();
    for (const label of SIDEBAR_ITEMS) {
      // Erişilebilir ad ikon metnini de içerir; alt dize eşleşmesi yeterli.
      await expect(nav.getByRole("link", { name: label })).toHaveCount(1);
    }
    for (const label of STAT_LABELS) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { level: 2, name: "Gelen talepler" }),
    ).toBeVisible();
  });

  await test.step("sekme/durum derin bağlantısı tam o görünümü açar", async () => {
    await page.goto("/hesap/taleplerim?sekme=incoming&durum=PENDING");
    await settle(page);
    // Grup 0: Gelen/Giden, grup 1: durum filtreleri.
    await expectActiveTab(page, 0, "Gelen");
    await expectActiveTab(page, 1, "Bekliyor");

    const row = tableRow(
      dataTable(page, "requests-table"),
      dateRangeLabel(stay.start, stay.end),
    );
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Bekliyor")).toBeVisible();
    await expect(row.getByText(LISTINGS.antalya)).toBeVisible();

    // Aynı derin bağlantı davranışı "Giden" yönünde de çalışır: sahibin giden
    // talebi yoktur → ilgili filtre boş durumu görünür (sekme/durum yine URL'den).
    await page.goto("/hesap/taleplerim?sekme=outgoing&durum=PENDING");
    await settle(page);
    await expectActiveTab(page, 0, "Giden");
    await expectActiveTab(page, 1, "Bekliyor");
    await expect(page.getByText("Henüz talebiniz yok")).toBeVisible();
  });

  await test.step("ilan durum derin bağlantısı ACTIVE sekmesini açar", async () => {
    await page.goto("/hesap/ilanlarim?durum=ACTIVE");
    await settle(page);
    await expectActiveTab(page, 0, "Yayında");

    const table = dataTable(page, "listings-table");
    await expect(tableRow(table, LISTINGS.antalya)).toHaveCount(1);
    await expect(tableRow(table, LISTINGS.izmir)).toHaveCount(1);
  });

  await test.step("Genel Bakış'ta satır içi onay tam sayfa yüklemesi olmadan günceller", async () => {
    await page.goto("/hesap");
    await settle(page);
    // İstemci tarafı tazeleme belgeyi korur; tam yükleme jetonu silerdi.
    const token = await markDocument(page);

    const panel = sectionByHeading(page, "Gelen talepler");
    const row = panel
      .getByRole("listitem")
      .filter({ hasText: dateRangeLabel(stay.start, stay.end) });
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Bekliyor")).toBeVisible();

    const approve = row.getByRole("button", { name: "Onayla" });
    await waitForHydration(approve);
    await approve.click();

    await expect(row.getByText("Onaylandı")).toBeVisible({ timeout: 30_000 });
    await expectSameDocument(page, token);
  });

  await page.close();
});
