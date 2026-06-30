// =============================================================================
// CUM RULEZ ACEST TEST (workaround Cloudflare prin CDP)
// =============================================================================
// Site-ul e protejat de Cloudflare, care blocheaza browserul lansat de Playwright.
// Solutia: pornesc manual un Chrome cu debug port, trec o data de Cloudflare, iar
// testul se ataseaza la acel Chrome (vezi ../fixtures.js). Cookie-ul de clearance
// se salveaza in profilul C:\Temp\chrome-cdp, deci de obicei NU mai apare challenge.
//
// PASII (manual):
//   1) Porneste Chrome cu debugging (in terminal PowerShell din VS Code):
//        Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" `
//          -ArgumentList '--remote-debugging-port=9222', `
//                        '--user-data-dir=C:\Temp\chrome-cdp', `
//                        'https://dev.chipy.com/shop'
//   2) In fereastra deschisa: daca apare Cloudflare, treci de el si asteapta
//      sa se incarce shop-ul. (De obicei se incarca direct, fara challenge.)
//   3) Ruleaza testul:
//        npx playwright test tests/chipy-shop-real-money-filter.spec.js --workers=1
//
// CE SA-I CER LUI CLAUDE IN CHAT ca sa faca el partea automata:
//   "Pornește Chrome cu debugging pe portul 9222 și rulează testul
//    tests/chipy-shop-real-money-filter.spec.js"
//   -> Claude porneste Chrome + ruleaza testul. Pasul cu Cloudflare (daca apare)
//      trebuie facut de tine manual in fereastra — Claude nu poate trece de el.
// =============================================================================
const { test, expect } = require("../fixtures");

test("Real Money filter - results count and card titles match", async ({
  page,
}) => {
  await page.goto("https://dev.chipy.com/shop");

  const resultsLocator = page.locator(
    "div[class='shop-manage-panel__total'] span",
  );

  const initialText = await resultsLocator.textContent();

  // Build a locator for the "Real Money" filter button. getByRole finds it by its
  // accessibility role ("button") and its visible text; exact:true means the name
  // must match "Real Money" exactly, not just contain it.
  const realMoneyFilterBtn = page.getByRole("button", {
    name: "Real Money",
    exact: true,
  });

  // Scroll the page until the filter button is in view (if it isn't already).
  // A button must be visible/in the viewport before Playwright can click it.
  await realMoneyFilterBtn.scrollIntoViewIfNeeded();

  // expect(...).toPass retries the whole block until it succeeds or 15s pass.
  // We use it because the button may take a moment to become clickable/active.
  await expect(async () => {
    // Read straight from the DOM whether the button already has the "active" class
    // (evaluate runs this little function inside the browser on the element).
    const isActive = await realMoneyFilterBtn.evaluate((el) =>
      el.classList.contains("active"),
    );
    // Only click if the filter isn't active yet (avoids toggling it back off).
    if (!isActive) await realMoneyFilterBtn.click();
    // Confirm the click worked: the button must now carry the "active" class.
    await expect(realMoneyFilterBtn).toHaveClass(/\bactive\b/);
  }).toPass({ timeout: 15000 });

  // Wait until the results counter text is DIFFERENT from what it was before the
  // click. This is how we know the filter actually re-ran and updated the list.
  await expect(resultsLocator).not.toHaveText(initialText, { timeout: 10000 });

  // Wait until there are no more network requests in flight, i.e. the filtered
  // data has finished loading. Ensures we read a stable, final state below.
  await page.waitForLoadState("networkidle");

  // Read the counter's current text (e.g. "4") now that the filter is applied.
  const resultsText = await resultsLocator.textContent();
  // Convert that text into an actual number so we can compare it with counts.
  const resultsNumber = parseInt(resultsText);
  // Print the number to the test output — handy for debugging while developing.
  console.log(`Total results after filtering: ${resultsNumber}`);

  if (resultsNumber === 0) {
    // No results: instead of cards, the "No items found" message must appear.
    // Locate that message by its CSS class.
    const noResults = page.locator("span.no-results-text");
    // Assert the message is actually visible on the page.
    await expect(noResults).toBeVisible();
    // Assert its text is exactly the expected empty-state message.
    await expect(noResults).toHaveText(
      "No items found matching your criteria.",
    );
  } else {
    // There are results: the number of cards must equal the counter, and every
    // card title must contain "Real Money".

    // Narrow down to the "Available Items" list container (the first such list).
    const availableItemsSection = page
      .locator(".shop-main-section__list")
      .first();
    // Inside that container, locate every card's title link (article > h3 > a).
    const cardTitles = availableItemsSection.locator("article > h3 > a");

    // Count how many title links (i.e. cards) are currently rendered.
    const cardsCount = await cardTitles.count();
    // The rendered card count must match the number shown by the counter.
    expect(cardsCount).toBe(resultsNumber);

    // Grab the text of every title into an array of strings.
    const allTitles = await cardTitles.allTextContents();
    // Go through each title and assert it contains "Real Money".
    for (const title of allTitles) {
      expect(title).toContain("Real Money");
    }
  }
});
