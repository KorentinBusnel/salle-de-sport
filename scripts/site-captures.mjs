#!/usr/bin/env node
// Captures du produit pour le site vitrine (apps/site/public/captures) et image de partage
// (apps/site/app/opengraph-image.png), prises sur les données de démo du seed.
//
// Prérequis (voir README, « Site vitrine ») : Supabase local après `pnpm db:reset`, le back
// office (`pnpm --filter @salle/backoffice build && … start`, port 3000), l'export web de l'app
// servi sur le port 8081 et, pour l'image de partage, le site (port 3001).
//
//   node scripts/site-captures.mjs [--only backoffice|app|og] [--backoffice URL] [--app URL] [--site URL]
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Playwright est installé hors du dépôt dans les sessions cloud : résolution par NODE_PATH.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    backoffice: { type: "string", default: "http://localhost:3000" },
    app: { type: "string", default: "http://localhost:8081" },
    site: { type: "string", default: "http://localhost:3001" },
  },
});

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CAPTURES = `${ROOT}apps/site/public/captures`;
const CONTEXT = { locale: "fr-FR", timezoneId: "Europe/Paris" };
const JPEG = { type: "jpeg", quality: 82 };
const PASSWORD = "demo1234";

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/** Back office en gérant : la page Aujourd'hui entière, les autres limitées au panneau principal. */
async function backoffice(browser) {
  const context = await browser.newContext({
    ...CONTEXT,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(`${args.backoffice}/login`);
  await page.fill('input[name="email"]', "gerant@demo.local");
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));

  await page.goto(`${args.backoffice}/`);
  await settle(page);
  // La liste de mise en route disparaît une fois la salle configurée (logo, adresse, horaires) :
  // la capture montre l'accueil d'une salle en activité.
  await page
    .locator('[aria-labelledby="mise-en-route"]')
    .evaluateAll((cards) => cards.forEach((card) => card.remove()));
  await page.screenshot({ path: `${CAPTURES}/aujourdhui.jpg`, ...JPEG });

  await page.goto(`${args.backoffice}/adherents`);
  await settle(page);
  const member = await page.locator('a[href^="/adherents/"]').first().getAttribute("href");

  const panels = [
    ["planning", "/planning", 640],
    ["paiements", "/paiements", 640],
    ["fiche-adherent", member, 640],
    ["heures-coachs", "/coachs/heures", 560],
  ];
  for (const [name, path, height] of panels) {
    await page.goto(`${args.backoffice}${path}`);
    await settle(page);
    const box = await page.locator('[data-slot="sidebar-inset"]').boundingBox();
    await page.screenshot({
      path: `${CAPTURES}/${name}.jpg`,
      clip: { x: box.x, y: box.y, width: box.width, height },
      ...JPEG,
    });
  }
  await context.close();
}

/** App adhérent (export web) : planning du samedi, connecté en adhérent. */
async function app(browser) {
  const context = await browser.newContext({
    ...CONTEXT,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${args.app}/`);
  const inputs = page.locator("input");
  await inputs.first().waitFor();
  await inputs.nth(0).fill("adherent@demo.local");
  await inputs.nth(1).fill(PASSWORD);
  await page.getByText("Se connecter", { exact: true }).last().click();
  await page.getByRole("tab", { name: "Planning" }).waitFor();
  await page
    .getByText(/^Sam\. /)
    .first()
    .click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${CAPTURES}/app-planning.jpg`, ...JPEG });
  await context.close();
}

/** Image de partage : le haut de la page d'accueil du site, en 1200 × 630. */
async function og(browser) {
  const context = await browser.newContext({ ...CONTEXT, viewport: { width: 1200, height: 630 } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${args.site}/`);
  await settle(page);
  await page.screenshot({ path: `${ROOT}apps/site/app/opengraph-image.png` });
  await context.close();
}

const browser = await chromium.launch();
try {
  const steps = { backoffice, app, og };
  for (const [name, step] of Object.entries(steps)) {
    if (args.only && args.only !== name) continue;
    await step(browser);
    console.log(`${name} : ok`);
  }
} finally {
  await browser.close();
}
