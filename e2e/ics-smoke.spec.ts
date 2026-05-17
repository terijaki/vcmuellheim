import { expect, test } from "@playwright/test";

test.describe("ics smoke", () => {
  test.skip(
    !process.env.AWS_REGION || !process.env.BETTER_AUTH_SECRET,
    "Requires AWS_REGION and BETTER_AUTH_SECRET to generate ICS data",
  );

  test("/ics/all.ics returns an iCalendar payload", async ({ request }) => {
    const response = await request.get("/ics/all.ics");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/calendar");

    const body = await response.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
  });
});
