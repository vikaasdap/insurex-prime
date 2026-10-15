import type { CatalogTemplate, PolicyTemplate } from "./types.js";

/** [name, plan number, UIN] as listed on the insurer's product pages. The plan number is the policy code. */
const plans = (rows: [name: string, planNo: string, uin: string][]): PolicyTemplate[] =>
  rows.map(([name, planNo, uin]) => ({ name, policyCode: `LIC-${planNo}`, uin }));

/**
 * LIC (Life Insurance Corporation of India): the Life line, grouped by the main plan sections
 * of the insurer's Products menu. Names are shown without the "LIC's" brand prefix. Sections
 * without policies yet are filled in by the agency, or here as the lists are collected.
 */
export const licTemplate: CatalogTemplate = [
  {
    line: "LIFE",
    categories: [
      {
        name: "Insurance Plans",
        categories: [
          {
            name: "Endowment Plans",
            policies: plans([
              ["Single Premium Endowment Plan", "717", "512N283V03"],
              ["New Endowment Plan", "714", "512N277V03"],
              ["New Jeevan Anand", "715", "512N279V03"],
              ["Jeevan Lakshya", "733", "512N297V03"],
              ["Jeevan Labh Plan", "736", "512N304V03"],
              ["Amritbaal", "774", "512N365V02"],
              ["Nav Jeevan Shree", "912", "512N387V02"],
              ["Bima Lakshmi", "881", "512N389V01"],
              ["New Jeevan Sathi - Single Premium", "888", "512N393V01"],
              ["New Jeevan Sathi - Limited Premium", "889", "512N394V01"],
              ["New Bima Jyoti", "890", "512N395V01"],
              ["Bima Platinum", "770", "512N397V01"],
            ]),
          },
          { name: "Whole Life Plans" },
          { name: "Money Back Plans" },
          { name: "Term Assurance Plans" },
          { name: "Riders" },
        ],
      },
      { name: "Pension Plans" },
      { name: "Unit Linked Plans" },
      { name: "Health Insurance Plans" },
      { name: "Micro Insurance Plans" },
      { name: "Withdrawn Plans" },
      { name: "GIFT City Plans" },
    ],
  },
];
