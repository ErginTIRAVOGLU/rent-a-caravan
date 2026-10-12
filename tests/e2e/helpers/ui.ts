import { expect, type Locator, type Page } from "@playwright/test";

/** GG-AA-YYYY (bugün + `offsetDays`); UTC tabanlı (sunucu UTC gün karşılaştırır). */
export function isoDay(offsetDays: number): string {
  const now = new Date();
  const shifted = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  );
  return shifted.toISOString().slice(0, 10);
}

/** "GG.AA.YYYY" — taleplerim listesindeki tarih biçimi (UTC gün). */
export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** "25.11.2026 – 28.11.2026" — taleplerim listesindeki tarih aralığı metni. */
export function dateRangeLabel(startIso: string, endIso: string): string {
  return `${formatDay(startIso)} – ${formatDay(endIso)}`;
}

/** Sayfadaki belirli başlığı taşıyan `<section>` (sayfalar birkaç section içerir). */
export function sectionByHeading(page: Page, heading: string): Locator {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: heading }) })
    .first();
}

/** Panel navigasyon grubu (ör. "Hesap menüsü" / "Yönetim menüsü"). */
export function panelNav(page: Page, name: string): Locator {
  return page.getByRole("navigation", { name });
}

/**
 * Panel durum sekmesi grubu — sayfada üstten `index`. Taleplerim'de iki grup
 * vardır (0: Gelen/Giden, 1: durum filtreleri); diğer listelerde tek grup (0).
 */
export function tabGroup(page: Page, index = 0): Locator {
  return page.getByRole("navigation", { name: "Durum sekmeleri" }).nth(index);
}

/**
 * Etiketli sekme bağlantısı. Etiket, sayaç rozetini (ör. "Giden 2") de
 * içerdiğinden başlangıç eşleşmesiyle aranır.
 */
export function tabLink(page: Page, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page
    .getByRole("navigation", { name: "Durum sekmeleri" })
    .getByRole("link", { name: new RegExp(`^${escaped}(?:\\s|$)`) });
}

/** Sekmeye tıklar ve gezinmenin oturmasını bekler. */
export async function selectTab(page: Page, label: string): Promise<void> {
  await tabLink(page, label).click();
  await settle(page);
}

/** İstenen sekme grubunda tek aktif sekmeyi ve etiketini doğrular. */
export async function expectActiveTab(
  page: Page,
  groupIndex: number,
  label: string,
): Promise<void> {
  const active = tabGroup(page, groupIndex).locator('[aria-current="page"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(new RegExp(`^${label}`));
}

/** `data-testid` ile panel veri tablosu/kart kabı (görünür sunum seçilir). */
export function dataTable(page: Page, testId: string): Locator {
  return page.getByTestId(testId);
}

/** Tablo gövdesindeki satır (metinle filtre); mobil kart sunumunu dışlar. */
export function tableRow(table: Locator, text: string | RegExp): Locator {
  return table.locator("tbody tr").filter({ hasText: text });
}

/**
 * Geçerli belgeye bir işaret koyar ve jetonunu döner. `router.refresh()` gibi
 * istemci tarafı tazelemeler belgeyi korur; tam sayfa yüklemesi işareti siler.
 */
export async function markDocument(page: Page): Promise<number> {
  return page.evaluate(() => {
    const token = Date.now();
    (window as Window & { __panelDocToken?: number }).__panelDocToken = token;
    return token;
  });
}

/** İşaret korunmuş mu — tam sayfa yüklemesi OLMADIĞININ kanıtı. */
export async function expectSameDocument(
  page: Page,
  token: number,
): Promise<void> {
  const current = await page.evaluate(
    () =>
      (window as Window & { __panelDocToken?: number }).__panelDocToken ?? null,
  );
  expect(current).toBe(token);
}

/**
 * Navigasyon sonrası sayfanın etkileşime hazır olmasını bekler.
 *
 * Neden gerekli: React hidrasyonu tamamlanmadan yapılan tıklama KAYBOLUR —
 * istemci bileşenlerin olay işleyicileri henüz bağlanmamıştır (buton DOM'da
 * görünür ve tıklanabilir görünür ama hiçbir şey olmaz). Ayrıca hidrasyon
 * penceresinde içerik kısa süre iki kez render edilebilir.
 *
 * `networkidle` (sayfa yüklendikten sonra ağın susması) bu pencerenin
 * kapanmasını bekler; sabit bir bekleme (waitForTimeout) kullanılmaz.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

/**
 * Bir yer tutucunun (ör. form/radyo grubu/buton) DOM'da TEK ve görünür hâline
 * gelmesini bekler — hidrasyon penceresindaki geçici çift render koruması.
 */
export async function waitForHydration(locator: Locator): Promise<void> {
  await expect(locator).toHaveCount(1);
  await expect(locator.first()).toBeVisible();
}

/** Arama sonucundan ilanı açar; detay sayfasına gelindiğini doğrular. */
export async function openListingFromSearch(
  page: Page,
  city: string,
  title: string,
): Promise<void> {
  await page.goto(`/arama?sehir=${encodeURIComponent(city)}`);
  await settle(page);
  const card = page.getByRole("listitem").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.getByRole("link").first().click();
  await settle(page);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

/** Arama sonucundaki ilan kartının göreli bağlantısını döndürür. */
export async function listingHrefFromSearch(
  page: Page,
  city: string,
  title: string,
): Promise<string> {
  await page.goto(`/arama?sehir=${encodeURIComponent(city)}`);
  await settle(page);
  const card = page.getByRole("listitem").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  const href = await card.getByRole("link").first().getAttribute("href");
  if (!href) {
    throw new Error(`İlan bağlantısı okunamadı: ${title}`);
  }
  return href;
}

/** Rezervasyon talep formunu doldurur (giriş/çıkış tarihi + kişi + mesaj). */
export async function fillBookingForm(
  page: Page,
  stay: { start: string; end: string; guests?: string },
  message?: string,
): Promise<void> {
  await page.getByLabel("Giriş", { exact: true }).fill(stay.start);
  await page.getByLabel("Çıkış", { exact: true }).fill(stay.end);
  await page.getByLabel("Kişi sayısı", { exact: true }).fill(stay.guests ?? "2");
  if (message !== undefined) {
    await page.getByLabel("Mesaj (opsiyonel)").fill(message);
  }
}
