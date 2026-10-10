import "dotenv/config";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL tanımlı değil. .env dosyasını .env.example'dan oluşturun.",
  );
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Test DB'si migration'larla senkronlanır (prisma migrate deploy).
    globalSetup: ["tests/helpers/global-setup.ts"],
    // Testler dev DATABASE_URL değil, TEST_DATABASE_URL kullanmalı (resetDb truncate eder).
    env: { DATABASE_URL: testDatabaseUrl },
    // Aynı DB'yi paylaşan dosyalar paralel koşarsa resetDb yarışır.
    fileParallelism: false,
    // Jest-dom matchers için setup dosyası
    setupFiles: ["tests/setup.ts"],
    // Vitest globals (expect, describe, it, etc.)
    globals: true,
  },
});
