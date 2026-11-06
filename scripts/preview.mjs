import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--config",
    "test/vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "5183",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Preview server timeout")),
      15000,
    );
    server.stdout.on("data", (data) => {
      if (data.toString().includes("5183")) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on("exit", () => reject(Error("Preview server exited")));
  });
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 920 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5183/test/fixture.html");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "src", exact: true }).click();
  await page.getByRole("button", { name: "a.ts", exact: true }).click();
  await page.locator(".cr-editor .cm-content").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Shift+ArrowDown");
  await page
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page
    .getByLabel("Referans notu")
    .fill("Bu fonksiyonun Python karşılığıyla farkı nedir?");
  await page.getByRole("button", { name: "b.py", exact: true }).click();
  await page.locator(".cr-editor .cm-content").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Shift+ArrowDown");
  await page
    .getByRole("button", { name: "Seçimi sohbete ekle", exact: true })
    .click();
  await page.locator(".cr-root").screenshot({ path: "docs/preview-light.png" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator(".cr-root").screenshot({ path: "docs/preview-dark.png" });
  if (errors.length) throw Error(errors.join("\n"));
  console.log("Light/dark previews rendered without browser errors.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
