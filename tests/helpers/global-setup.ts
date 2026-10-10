import { execSync } from "node:child_process";

/**
 * Vitest global setup: test DB'sini migration'larla senkronlar.
 * prisma.config.ts `env("DATABASE_URL")` okur; dotenv mevcut process.env değerini
 * ezmediği için child süreçte DATABASE_URL'i TEST_DATABASE_URL'e çeviriyoruz.
 */
export default function globalSetup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL tanımlı değil. .env dosyasını .env.example'dan oluşturun.",
    );
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
