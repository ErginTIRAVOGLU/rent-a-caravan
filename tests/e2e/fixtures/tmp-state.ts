import "dotenv/config";

import { prisma } from "../../../src/lib/prisma";

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<
    { pid: number; state: string; xact_start: Date | null; query: string }[]
  >`
    SELECT pid, state, xact_start, left(query, 120) AS query
    FROM pg_stat_activity
    WHERE datname = current_database()
    ORDER BY pid
  `;
  for (const row of rows) {
    console.log(`${row.pid} | ${row.state} | xact=${row.xact_start?.toISOString() ?? "-"} | ${row.query}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
