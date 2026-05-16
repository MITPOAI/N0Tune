import { expect, test } from "@playwright/test";

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:8000";
const uniqueUser = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

test.describe.serial("dashboard end-to-end flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Switch the global user_id field on the header so each test run is isolated.
    const userIdInput = page.locator('label:has-text("user_id") input');
    await userIdInput.fill(uniqueUser);
    await page.getByRole("button", { name: /^refresh$/i }).click();
  });

  test("create a memory and see it in the list", async ({ page }) => {
    await page.getByRole("tab", { name: "Memories" }).click();
    await page.locator('form input[name="type"]').fill("preference");
    await page
      .locator('form textarea[name="text"]')
      .fill("E2E user prefers short architecture answers.");
    await page.locator('form input[name="confidence"]').fill("0.95");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(
      page.getByText("E2E user prefers short architecture answers."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByText("E2E user prefers short architecture answers."),
    ).toBeHidden();
  });

  test("update the style profile", async ({ page }) => {
    await page.getByRole("tab", { name: "Style" }).click();
    await page.locator('form input[name="tone"]').fill("crisp");
    await page.locator('form input[name="depth"]').fill("high");
    await page
      .locator('form input[name="format"]')
      .fill("short bullets + 1 diagram");
    await page.locator('form input[name="avoid"]').fill("hype, fluff");
    await page.getByRole("button", { name: /update profile/i }).click();

    await page.getByRole("button", { name: /^refresh$/i }).click();
    await expect(page.locator('form input[name="tone"]')).toHaveValue("crisp");
  });

  test("index a document and preview compiled context", async ({ page }) => {
    await page.getByRole("tab", { name: "Documents" }).click();
    await page
      .locator('form input[name="title"]')
      .fill("E2E architecture note");
    await page.locator('form input[name="source"]').fill("e2e");
    await page
      .locator('form textarea[name="content"]')
      .fill(
        "N0Tune is the context compiler. The compiler decides which memories and chunks to include.",
      );
    await page.getByRole("button", { name: /index document/i }).click();
    await expect(page.getByText("E2E architecture note").first()).toBeVisible();

    await page.getByRole("tab", { name: "Context", exact: true }).click();
    const messageBox = page.locator("form textarea");
    await messageBox.fill("Explain what the N0Tune context compiler does.");
    await page.getByRole("button", { name: /compile context/i }).click();

    const savedBadge = page.getByText(/^saved\s+\d+/i);
    await expect(savedBadge).toBeVisible();
    await expect(savedBadge).toContainText(/saved\s+\d+/i);
    await expect(page.getByText("Selected docs")).toBeVisible();
    await expect(
      page.getByText("N0Tune is the context compiler.").first(),
    ).toBeVisible();
  });

  test("Context Lab compares two users with the same question", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "Context Lab" }).click();
    await page.getByLabel("User A id").fill(`${uniqueUser}_a`);
    await page.getByLabel("User B id").fill(`${uniqueUser}_b`);
    await page
      .getByLabel("Shared question")
      .fill("How should I explain RAG to a product team?");
    await page.getByRole("button", { name: /seed demo/i }).click();

    await expect(
      page.getByText("Context Lab seeded and previewed."),
    ).toBeVisible();
    await expect(page.getByText("User A", { exact: true })).toBeVisible();
    await expect(page.getByText("User B", { exact: true })).toBeVisible();
    await expect(
      page.getByText("short technical bullets").first(),
    ).toBeVisible();
    await expect(
      page.getByText("analogy-rich walkthroughs").first(),
    ).toBeVisible();
    await expect(page.getByText("Selected memories").first()).toBeVisible();
    await expect(page.getByText("Trace: selected").first()).toBeVisible();
  });

  test("clear the semantic cache from the dashboard", async ({ page }) => {
    await page.request.post(`${apiBase}/v1/chat`, {
      data: {
        app_id: "demo",
        user_id: uniqueUser,
        message: "Seed a cache entry for the E2E run.",
      },
    });

    await page.getByRole("tab", { name: "Cache" }).click();
    await page.getByRole("button", { name: /clear cache/i }).click();
    await page.getByRole("button", { name: /^refresh$/i }).click();

    await page.getByRole("tab", { name: "Overview" }).click();
    const cacheEntries = page
      .locator("p", { hasText: /^cache entries$/i })
      .locator("xpath=following-sibling::p[1]");
    await expect(cacheEntries).toHaveText("0");
  });
});
