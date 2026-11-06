import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test/fixture.html");
});

test("native directory paths with trailing separators show names and open nested folders", async ({
  page,
}) => {
  const tree = page.locator(".cr-tree");
  const src = tree.getByRole("button", { name: "src", exact: true });
  await expect(src).toHaveText("▸src");
  await src.click();
  await tree.getByRole("button", { name: "lib", exact: true }).click();
  await tree.getByRole("button", { name: "deeper", exact: true }).click();
  await tree.getByRole("button", { name: "helper.ts", exact: true }).click();
  await expect(page.locator(".cr-editor")).toContainText("export const helper");
});

async function openA(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "src", exact: true }).click();
  await page.getByRole("button", { name: "a.ts", exact: true }).click();
  await expect(page.locator(".cr-editor .cm-content")).toContainText(
    "function greet",
  );
}
async function selectFirstLine(page: import("@playwright/test").Page) {
  const code = page.locator(".cr-editor .cm-content");
  await code.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Shift+ArrowDown");
}
test("readonly code, context menu and multi-file reference notes produce a draft without sending", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page.locator(".cr-editor .cm-content").click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Add reference to chat", exact: true })
    .click();
  await expect(page.locator(".cr-ref")).toHaveCount(1);
  await page.getByLabel("Reference note").fill("The bug is here");
  await page.getByRole("button", { name: "b.py", exact: true }).click();
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await expect(page.locator(".cr-ref")).toHaveCount(2);
  await page.getByLabel("Select for comparison").nth(0).check();
  await page.getByLabel("Select for comparison").nth(1).check();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator("#draft")).toContainText("Compare");
  await expect(page.locator("#attachments")).toContainText("The bug is here");
  await page.locator(".cr-editor .cm-content").click();
  await page.keyboard.type("SHOULD_NOT_WRITE");
  await expect(page.locator(".cr-editor .cm-content")).not.toContainText(
    "SHOULD_NOT_WRITE",
  );
  await expect(page.locator("#sent")).toHaveText("0");
});
test("live updates flag frozen references and show before/after", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page.getByRole("button", { name: "Fixture: update" }).click();
  await expect(page.locator(".cr-ref")).toContainText(
    "Changed since selection",
  );
  await page.getByRole("button", { name: "Show changes", exact: true }).click();
  await expect(page.locator(".cr-diff")).toContainText("Before");
  await expect(page.locator(".cr-diff")).toContainText("hello");
  await expect(page.locator(".cr-diff")).toContainText("welcome");
});
test("quick open, content search, context expansion, history and session isolation", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Include context", exact: true })
    .click();
  await expect(page.locator(".cr-ref")).toContainText("1–4");
  await page.getByRole("button", { name: "Find file", exact: true }).click();
  await page.getByPlaceholder("File name…").fill("b.py");
  await page.locator(".cr-results").getByRole("button").first().click();
  await expect(page.locator(".cr-editor")).toContainText("def greet");
  await page
    .getByRole("button", { name: "Search project", exact: true })
    .click();
  await page.getByPlaceholder("Search project text…").fill("greet");
  await page.getByPlaceholder("Search project text…").press("Enter");
  await expect(page.locator(".cr-results")).toContainText("a.ts");
  await page.getByRole("button", { name: "Fixture: switch" }).click();
  await expect(page.locator(".cr-ref")).toHaveCount(0);
  await expect(page.locator(".cr-editor")).toHaveCount(0);
});

test("reference link reveals relocated code once and keeps navigation usable", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page.getByRole("button", { name: "b.py", exact: true }).click();
  await page.getByRole("button", { name: "Fixture: link" }).click();
  await expect(page.locator(".cr-file-toolbar")).toContainText("src/a.ts");
  await page
    .locator(".cr-tree")
    .getByRole("button", { name: "b.py", exact: true })
    .click();
  await expect(page.locator(".cr-file-toolbar")).toContainText("src/b.py");
});

test("frozen snapshots and deleted-file changes stay readable after the file disappears", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page.getByRole("button", { name: "Fixture: update" }).click();
  await page.getByRole("button", { name: "Fixture: delete" }).click();
  await page.getByRole("button", { name: "Snapshot", exact: true }).click();
  await expect(page.locator(".cr-snapshot")).toContainText("function greet");
  await page.getByRole("button", { name: "Back to current file" }).click();
  await page.getByRole("button", { name: "Show changes" }).click();
  await expect(page.locator(".cr-diff")).toContainText("hello");
});
test("a slow reference open cannot move selection onto a newly opened file", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page.getByRole("button", { name: "b.py", exact: true }).click();
  await page.getByRole("button", { name: "Fixture: slow" }).click();
  await page.locator(".cr-ref-link").click();
  await page
    .locator(".cr-tree")
    .getByRole("button", { name: "b.py", exact: true })
    .click();
  await expect(page.locator("#inflight")).toHaveText("0");
  await expect(page.locator(".cr-code-status")).toContainText("Ctrl+Shift+L");
  await expect(page.locator(".cr-file-toolbar")).toContainText("src/b.py");
});
test("opening a frozen copy cannot replace a newer navigation after a slow read", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page.getByRole("button", { name: "Fixture: slow" }).click();
  await page.getByRole("button", { name: "Snapshot", exact: true }).click();
  await page
    .locator(".cr-tree")
    .getByRole("button", { name: "b.py", exact: true })
    .click();
  await expect(page.locator("#inflight")).toHaveText("0");
  await expect(page.locator(".cr-snapshot")).toHaveCount(0);
  await expect(page.locator(".cr-editor")).toContainText("def greet");
});
test("unused watches are released but basket files stay watched", async ({
  page,
}) => {
  await openA(page);
  await page.getByRole("button", { name: "src/a.ts — close tab" }).click();
  await expect(page.locator("#watched")).not.toContainText("src/a.ts");
  await page
    .locator(".cr-tree")
    .getByRole("button", { name: "a.ts", exact: true })
    .click();
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Add selection to chat", exact: true })
    .click();
  await page.getByRole("button", { name: "src/a.ts — close tab" }).click();
  await expect(page.locator("#watched")).toContainText("src/a.ts");
  await page.getByRole("button", { name: "Clear basket" }).click();
  await expect(page.locator("#watched")).not.toContainText("src/a.ts");
});
test("reopening project search discards a scan from the previous query", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Fixture: slow" }).click();
  await page
    .getByRole("button", { name: "Search project", exact: true })
    .click();
  const input = page.getByPlaceholder("Search project text…");
  await input.fill("greet");
  await input.press("Enter");
  await expect(page.locator("#inflight")).not.toHaveText("0");
  await page
    .getByRole("button", { name: "Search project", exact: true })
    .click();
  await expect(page.locator("#inflight")).toHaveText("0");
  await expect(page.locator(".cr-results button")).toHaveCount(0);
  await expect(input).toHaveValue("");
});
