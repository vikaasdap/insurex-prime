/* eslint-disable no-console -- CLI script: console output is its interface */
/**
 * One-off: copies the built-in catalogs (TATA AIA, TATA AIG, LIC) into the master catalog
 * tables. Safe to re-run: an insurer that already has master rows is left alone.
 *
 *   pnpm --filter backend exec tsx --env-file=.env prisma/seed-master-catalog.ts
 */
import { createDatabase } from "../src/config/database.js";
import { seedMasterFromTemplate } from "../src/modules/catalog/master-catalog.service.js";
import { getCatalogTemplate } from "../src/modules/catalog/templates/index.js";

const db = createDatabase(process.env["DATABASE_URL"]!, 1);

for (const code of ["TATA_AIA", "TATA_AIG", "LIC"]) {
  const insurer = await db.insurer.findUnique({ where: { code } });
  const template = getCatalogTemplate(code);
  if (!insurer || !template) {
    console.log(`${code}: skipped (insurer or built-in catalog not found)`);
    continue;
  }
  const result = await seedMasterFromTemplate(db, insurer, template);
  console.log(
    result.skipped
      ? `${code}: already has a master catalog, left alone`
      : `${code}: ${result.categories} categories, ${result.policies} policies`,
  );
}
await db.$disconnect();
