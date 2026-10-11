/**
 * Kök Playwright yapılandırması — gerçek ayarlar `tests/e2e/playwright.config.ts`
 * içindedir (SDD Task-12 brief'i yapılandırmayı orada ister). Bu dosya yalnızca
 * `npx playwright test` komutunun kökten çalıştırıldığında aynı yapılandırmayı
 * bulması için vardır; test koşumunu her zaman şu komutla yapın:
 *
 *   npx playwright test --config tests/e2e/playwright.config.ts
 */
export { default } from "./tests/e2e/playwright.config";
