import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test/fixture.html");
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
    .getByRole("menuitem", { name: "Sohbete referans ekle", exact: true })
    .click();
  await expect(page.locator(".cr-ref")).toHaveCount(1);
  await page.getByLabel("Referans notu").fill("Hata burada");
  await page.getByRole("button", { name: "b.py", exact: true }).click();
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await expect(page.locator(".cr-ref")).toHaveCount(2);
  await page.getByLabel("Karşılaştırmaya seç").nth(0).check();
  await page.getByLabel("Karşılaştırmaya seç").nth(1).check();
  await page.getByRole("button", { name: "Karşılaştır", exact: true }).click();
  await expect(page.locator("#draft")).toContainText("karşılaştır");
  await expect(page.locator("#attachments")).toContainText("Hata burada");
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
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page.getByRole("button", { name: "Fixture: update" }).click();
  await expect(page.locator(".cr-ref")).toContainText("Seçimden sonra değişti");
  await page
    .getByRole("button", { name: "Değişiklikleri göster", exact: true })
    .click();
  await expect(page.locator(".cr-diff")).toContainText("Önce");
  await expect(page.locator(".cr-diff")).toContainText("hello");
  await expect(page.locator(".cr-diff")).toContainText("merhaba");
});
test("quick open, content search, context expansion, history and session isolation", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Çevresini ekle", exact: true })
    .click();
  await expect(page.locator(".cr-ref")).toContainText("1–4");
  await page.getByRole("button", { name: "Dosya bul", exact: true }).click();
  await page.getByPlaceholder("Dosya adı…").fill("b.py");
  await page.locator(".cr-results").getByRole("button").first().click();
  await expect(page.locator(".cr-editor")).toContainText("def greet");
  await page.getByRole("button", { name: "Projede ara", exact: true }).click();
  await page.getByPlaceholder("Proje içinde metin ara…").fill("greet");
  await page.getByPlaceholder("Proje içinde metin ara…").press("Enter");
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
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
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
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page.getByRole("button", { name: "Fixture: update" }).click();
  await page.getByRole("button", { name: "Fixture: delete" }).click();
  await page.getByRole("button", { name: "Sabit kopya", exact: true }).click();
  await expect(page.locator(".cr-snapshot")).toContainText("function greet");
  await page.getByRole("button", { name: "Güncel dosyaya dön" }).click();
  await page.getByRole("button", { name: "Değişiklikleri göster" }).click();
  await expect(page.locator(".cr-diff")).toContainText("hello");
});
test("a slow reference open cannot move selection onto a newly opened file", async ({
  page,
}) => {
  await openA(page);
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
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
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page.getByRole("button", { name: "Fixture: slow" }).click();
  await page.getByRole("button", { name: "Sabit kopya", exact: true }).click();
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
  await page.getByRole("button", { name: "src/a.ts sekmesini kapat" }).click();
  await expect(page.locator("#watched")).not.toContainText("src/a.ts");
  await page
    .locator(".cr-tree")
    .getByRole("button", { name: "a.ts", exact: true })
    .click();
  await selectFirstLine(page);
  await page
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page.getByRole("button", { name: "src/a.ts sekmesini kapat" }).click();
  await expect(page.locator("#watched")).toContainText("src/a.ts");
  await page.getByRole("button", { name: "Sepeti temizle" }).click();
  await expect(page.locator("#watched")).not.toContainText("src/a.ts");
});
test("reopening project search discards a scan from the previous query", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Fixture: slow" }).click();
  await page.getByRole("button", { name: "Projede ara", exact: true }).click();
  const input = page.getByPlaceholder("Proje içinde metin ara…");
  await input.fill("greet");
  await input.press("Enter");
  await expect(page.locator("#inflight")).not.toHaveText("0");
  await page.getByRole("button", { name: "Projede ara", exact: true }).click();
  await expect(page.locator("#inflight")).toHaveText("0");
  await expect(page.locator(".cr-results button")).toHaveCount(0);
  await expect(input).toHaveValue("");
});
