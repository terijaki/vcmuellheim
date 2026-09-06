import { expect, test } from "@playwright/test";

/**
 * SAMS route smokes — tolerant of empty DynamoDB / missing clubs & teams sync.
 * Asserts HTTP 200 and a settled UI state (data, empty, or graceful error), never a crash.
 *
 * Routes whose loaders require DynamoDB are skipped when AWS_REGION is unset
 * (Playwright's default `vp dev` webServer has no AWS credentials).
 * Point WEBAPP_URL at a `vpr`-started server (or set AWS_REGION) to run the full suite.
 * Seeded-projection assertions also need SAMS_SEEDED=true (CI sets this after db:seed:sams).
 */
const hasAws = Boolean(process.env.AWS_REGION);

test.describe("sams smoke", () => {
  test("/termine renders and match section settles", async ({ page }) => {
    const response = await page.goto("/termine", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible();

    await expect(
      page.getByText(/Keine Ligaspiele|Ligaspiele|Fehler beim Laden der SBVV Ligaspiele/i),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("homepage heimspiele section mounts without error", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText(/Willkommen beim/i).first()).toBeVisible();
    // Section always mounts; empty copy appears after SAMS teams resolve (may be empty pre-sync).
    await expect(page.locator("#heimspiele")).toBeAttached();
  });

  test.describe("requires DynamoDB", () => {
    test.skip(!hasAws, "Requires AWS_REGION (use WEBAPP_URL against a vpr-started server)");

    test("/tabelle renders and settles", async ({ page }) => {
      const response = await page.goto("/tabelle", { waitUntil: "domcontentloaded" });

      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: "Tabelle" })).toBeVisible();

      await expect(
        page.getByText(/Keine Daten gefunden|Unsere letzten|Fehler beim Laden der letzten Spiele/i),
      ).toBeVisible({ timeout: 20_000 });
    });

    test("/teams renders the team index", async ({ page }) => {
      const response = await page.goto("/teams", { waitUntil: "domcontentloaded" });

      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: "Mannschaften" })).toBeVisible();
      await expect(page.getByText(/Zurzeit umfasst unser Verein/i)).toBeVisible();
    });

    test("unknown team slug shows not-found UI", async ({ page }) => {
      const response = await page.goto("/teams/e2e-nonexistent-team-slug", {
        waitUntil: "domcontentloaded",
      });

      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: "Mannschaft nicht gefunden" })).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  test.describe("seeded projections", () => {
    // Prod is never seeded (`db:seed:sams` is skipped on main). WEBAPP_URL is
    // always set in CI, including against vcmuellheim.de after merge.
    test.skip(
      process.env.SAMS_SEEDED !== "true",
      "Requires SAMS_SEEDED=true against a webapp seeded with SAMS provider fixtures",
    );

    test("/termine shows league matches from projections", async ({ page }) => {
      const response = await page.goto("/termine", { waitUntil: "domcontentloaded" });

      expect(response?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: "Ligaspiele" })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.locator("[data-match-uuid]").first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("Keine Ligaspiele")).toHaveCount(0);
    });
  });
});
