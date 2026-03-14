import { expect, test } from "@playwright/test";

test("sign-in screen is available", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("Plant Audit")).toBeVisible();
  await expect(page.getByRole("button", { name: /email me a sign-in link/i })).toBeVisible();
});
