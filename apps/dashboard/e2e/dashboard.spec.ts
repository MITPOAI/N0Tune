import { expect, test } from "@playwright/test";

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:8000";
const uniqueUser = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

test.describe.serial("dashboard end-to-end flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait until the dashboard has actually hydrated. The Wait-for-dashboard
    // CI step only checks that the Next.js server returns HTTP 200; in CI
    // we've seen the test race past React hydration on cold start, which
    // makes early click events get dropped by the bare DOM (no React handler
    // attached yet). The Refresh button is the first interactive element on
    // the page, so its presence is a reliable hydration signal.
    await page.getByRole("button", { name: /^refresh$/i }).waitFor({
      state: "visible",
      timeout: 30_000,
    });
    // Switch the global user_id field on the header so each test run is isolated.
    await page.getByLabel("User ID").fill(uniqueUser);
    await page.getByRole("button", { name: /^refresh$/i }).click();
  });

  test("create a memory and see it in the list", async ({ page }) => {
    await page.getByRole("button", { name: "Memory Library" }).click();
    await page.locator('form input[name="type"]').fill("preference");
    await page
      .locator('form textarea[name="text"]')
      .fill("E2E user prefers short architecture answers.");
    await page.locator('form input[name="confidence"]').fill("0.95");

    // Wait for the actual POST so we're not racing the refresh fetch that
    // follows it. Either the POST succeeds and we can assert on the rendered
    // text, or the response surfaces a clear error.
    const postPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/v1/memories") &&
        resp.request().method() === "POST",
    );
    await page.getByRole("button", { name: /save memory/i }).click();
    const postResponse = await postPromise;
    expect(
      postResponse.ok(),
      `POST /v1/memories failed: ${postResponse.status()}`,
    ).toBeTruthy();

    await expect(
      page.getByText("E2E user prefers short architecture answers.").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(
      page.getByText("E2E user prefers short architecture answers."),
    ).toBeHidden();
  });

  test("update the style profile", async ({ page }) => {
    await page.getByRole("button", { name: "Memory Library" }).click();
    await page.locator('form input[name="tone"]').fill("crisp");
    await page.locator('form input[name="depth"]').fill("high");
    await page
      .locator('form input[name="format"]')
      .fill("short bullets + 1 diagram");
    await page.locator('form input[name="avoid"]').fill("hype, fluff");
    await page.getByRole("button", { name: /update style profile/i }).click();

    await page.getByRole("button", { name: /^refresh$/i }).click();
    await expect(page.locator('form input[name="tone"]')).toHaveValue("crisp");
  });

  test("index a document and preview compiled context", async ({ page }) => {
    await page.getByRole("button", { name: "Files" }).click();
    await page
      .locator('form input[name="title"]')
      .fill("E2E architecture note");
    await page.locator('form input[name="source"]').fill("e2e");
    await page
      .locator('form textarea[name="content"]')
      .fill(
        "N0Tune is the context compiler. The compiler decides which memories and chunks to include.",
      );
    await page
      .getByRole("button", { name: "Index document", exact: true })
      .click();
    await expect(page.getByText("E2E architecture note").first()).toBeVisible();

    await page.getByRole("button", { name: "Command Center" }).click();
    const messageBox = page.getByLabel("Context preview message");
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
    await page.getByRole("button", { name: "Context Lab" }).click();
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
    await expect(page.getByText("beginner explanations").first()).toBeVisible();
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

    await page.getByRole("button", { name: "Cache" }).click();
    await page.getByRole("button", { name: /clear cache/i }).click();
    await page.getByRole("button", { name: /^refresh$/i }).click();

    await expect(page.getByText("Cache is empty")).toBeVisible();
  });
});
