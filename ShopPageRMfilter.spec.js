const { test, expect } = require("@playwright/test");
const { read } = require("node:fs");

test("Real Money filter - results count and card titles match", async ({
  page,
}) => {
  await page.goto("https://dev.chipy.com/shop");
  const realMoneyFilterBtn = page.getByRole("button", { name: "Real Money" });
  await realMoneyFilterBtn.scrollIntoViewIfNeeded();
  await realMoneyFilterBtn.click({ force: true });
  await page.pause();
  await page.waitForLoadState("networkidle");

  const resultsText = await page
    .locator("div[class='shop-manage-panel__total'] span")
    .textContent();
  const resultsNumber = parseInt(resultsText);
  const cardTitles = page.locator(
    "div.shop-main-section__list > article > h3 > a",
  );

  const cardsCount = await cardTitles.count();

  expect(cardsCount).toBe(resultsNumber);

  const allTitles = await cardTitles.allTextContents();

  for (const title of allTitles) {
    expect(title).toContain("Real Money");
  }
});
