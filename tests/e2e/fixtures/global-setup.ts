import "./env";

import { prisma } from "../../../src/lib/prisma";
import { prepareDatabase } from "./prepare-db";

/**
 * Playwright globalSetup: testler koşmadan önce dev DB önkoşullarını hazırlar.
 * Bkz. `prepare-db.ts` başındaki açıklama (hangi veriyi neden değiştirdiği).
 */
export default async function globalSetup(): Promise<void> {
  await prepareDatabase();
  await prisma.$disconnect();
}
