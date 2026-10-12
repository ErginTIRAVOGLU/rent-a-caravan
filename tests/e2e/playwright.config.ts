import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright yapılandırması — Karavan SOSYAL KATIMAN E2E senaryoları 1-5.
 *
 * WebServer kararı: `npm run build && npm run start` (üretim derlemesi).
 *   - Build HEAD'de yeşil; üretim sunucusu istek başına derleme gecikmesi
 *     (dev) yaşanmadan çalıştığı için e2e testleri daha kararlı ve hızlıdır.
 *   - `reuseExistingServer: !process.env.CI` → CI'da her zaman yeni sunucu
 *     açılır, yerelde 3000 portunda çalışan bir dev/start sunucusu yeniden
 *     kullanılır (gereksiz rebuild yapılmaz).
 *   - Zaman aşımı: build + start penceresi 4 dakikaya yükseltildi.
 *
 * Test keşfi: kökteki `playwright.config.ts` bu dosyayı yeniden export eder,
 * bu yüzden `npx playwright test` (kök) ve
 * `npx playwright test --config tests/e2e/playwright.config.ts` aynı davranır.
 *
 * Veritabanı: testler dev DB'yi (DATABASE_URL) kullanır; çalışma öncesi
 * `globalSetup` önkoşulleri hazırlar (bkz. `fixtures/global-setup.ts`).
 */

// `__dirname` modül bazlıdır: kök config yeniden export etse bile yollar
// daima tests/e2e dizinine göre çözümlenir.
const e2eDir = __dirname;

// Yerelde başka bir porttaki sunucuya karşı koşmak için: E2E_BASE_URL
// (ör. PowerShellda `$env:E2E_BASE_URL="http://localhost:3001"`). CI'da ve
// varsayılanda http://localhost:3000 kullanılır.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: e2eDir,
  // Senaryolar aynı dev DB'sini paylaşır (bekleyen talep, onay bekleyen ilan
  // gibi önkoşulleri birbirini etkiler) → paralellik kapalı.
  fullyParallel: false,
  workers: 1,
  // CI'da `test.only` yanlışlıkla commit edilmesin.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"]] : [["list"]],
  // Sunucu bileşenleri + DB gecikmeleri için cömert zaman aşımları.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: path.join(e2eDir, "fixtures/global-setup.ts"),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
