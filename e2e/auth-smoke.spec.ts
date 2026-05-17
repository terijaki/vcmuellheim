import { expect, test } from "@playwright/test";

test.describe("auth smoke", () => {
  test("admin login renders for anonymous user", async ({ page }) => {
    const response = await page.goto("/admin/login", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "VC Müllheim Anmeldung" })).toBeVisible();
    await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  });

  test("/admin redirects anonymous users to login", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/admin/login");
    expect(finalUrl.searchParams.get("redirect")).toMatch(/^\/admin\/?$/);
    await expect(page.getByRole("heading", { name: "VC Müllheim Anmeldung" })).toBeVisible();
  });

  test("otp login route renders error state without parameters", async ({ page }) => {
    const response = await page.goto("/admin/otp-login", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Anmeldung" })).toBeVisible();
    await expect(page.getByText("Der Anmeldelink ist unvollständig.")).toBeVisible();
  });
});
