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
