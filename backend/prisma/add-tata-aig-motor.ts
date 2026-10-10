/* eslint-disable no-console -- CLI script: console output is its interface */
/**
 * Adds the TATA AIG Motor policies (Two Wheeler, Four Wheeler) to every tenant that already
 * has TATA AIG but no Motor policies for it. Health data is not touched.
 *
 *   npx tsx --env-file=.env prisma/add-tata-aig-motor.ts            # dry run, lists tenants
 *   npx tsx --env-file=.env prisma/add-tata-aig-motor.ts --confirm  # writes
 */
import { createDatabase } from "../src/config/database.js";
import { installCatalog } from "../src/modules/catalog/catalog.service.js";
import { getCatalogTemplate } from "../src/modules/catalog/templates/index.js";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = createDatabase(process.env.DATABASE_URL, 1);
const confirm = process.argv.includes("--confirm");
const motor = getCatalogTemplate("TATA_AIG")!.filter((line) => line.line === "MOTOR");

const insurer = await db.insurer.findFirst({ where: { code: "TATA_AIG" } });
if (!insurer) {
  console.log("No TATA_AIG insurer found.");
} else {
  const tenantIds = [
    ...new Set(
      (await db.policy.findMany({ where: { insurerId: insurer.id }, select: { tenantId: true } })).map(
        (row) => row.tenantId,
      ),
    ),
  ];
  for (const tenantId of tenantIds) {
    const existing = await db.policy.count({
      where: { tenantId, insurerId: insurer.id, insuranceType: "MOTOR" },
    });
    if (existing > 0) {
      console.log(`${tenantId}: already has ${existing} Motor policies, skipped`);
      continue;
    }
    if (!confirm) {
      console.log(`${tenantId}: would add 2 Motor policies`);
      continue;
    }
    const counts = await db.$transaction((tx) => installCatalog(tx, tenantId, insurer, motor));
    console.log(`${tenantId}: added ${counts.policies} Motor policies`);
  }
}
await db.$disconnect();
