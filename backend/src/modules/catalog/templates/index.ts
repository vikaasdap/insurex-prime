import { licTemplate } from "./lic.js";
import { tataAigTemplate } from "./tata-aig.js";
import { tataAiaTemplate } from "./tata-aia.js";
import type { CatalogTemplate } from "./types.js";

/** Built-in starter catalogs, keyed by `Insurer.code`. */
const TEMPLATES: Record<string, CatalogTemplate> = {
  TATA_AIA: tataAiaTemplate,
  TATA_AIG: tataAigTemplate,
  LIC: licTemplate,
};

export const getCatalogTemplate = (insurerCode: string): CatalogTemplate | undefined =>
  TEMPLATES[insurerCode];

export const hasCatalogTemplate = (insurerCode: string) => insurerCode in TEMPLATES;

export type { CatalogTemplate } from "./types.js";
