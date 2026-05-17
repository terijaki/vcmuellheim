import { expect, test } from "@playwright/test";

test.describe("auth smoke", () => {
  test("admin login renders for anonymous user", async ({ page }) => {
    const response = await page.goto("/admin/login", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "VC Müllheim Anmeldung" })).toBeVisible();
    await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();
  });

  test("admin login allows requesting an OTP code", async ({ page }) => {
    const response = await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
    const emailInput = page.getByLabel("E-Mail-Adresse");
    const requestCodeButton = page.getByRole("button", { name: "Anmeldecode senden" });

    expect(response?.ok()).toBeTruthy();
    await expect
      .poll(async () => {
        await emailInput.fill("E2E-TEST@vcmuellheim.de"); // Intentionally test case insensitivity of email input
        return requestCodeButton.isEnabled();
      })
      .toBe(true);
    await requestCodeButton.click();

    await expect(
      page.getByText(
        "Wenn die E-Mail-Adresse (e2e-test@vcmuellheim.de) registriert ist, wurde ein Anmeldecode verschickt.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Bitte gib den 6-stelligen Code ein, der dir zugeschickt wurde."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
  });

  test("/admin redirects anonymous users to login", async ({ page }) => {
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/admin/login");
    expect(finalUrl.searchParams.get("redirect")).toMatch(/^\/admin\/?$/);
    await expect(page.getByRole("heading", { name: "VC Müllheim Anmeldung" })).toBeVisible();
  });

  test("/admin/events redirects anonymous users to login and preserves destination", async ({
    page,
  }) => {
    await page.goto("/admin/events", { waitUntil: "domcontentloaded" });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/admin/login");
    expect(finalUrl.searchParams.get("redirect")).toMatch(/^\/admin\/events\/?$/);
    await expect(page.getByRole("heading", { name: "VC Müllheim Anmeldung" })).toBeVisible();
  });

  test("otp login route renders error state without parameters", async ({ page }) => {
    const response = await page.goto("/admin/otp-login", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Anmeldung" })).toBeVisible();
    await expect(page.getByText("Der Anmeldelink ist unvollständig.")).toBeVisible();
  });
});
