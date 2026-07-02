// =============================================================================
// HOW TO RUN THIS TEST (Cloudflare workaround via CDP)
// =============================================================================
// Same setup as the other shop tests: start a manual Chrome with a debug port,
// pass Cloudflare once, then this test attaches to it (see ../fixtures.js).
//
//   1) Start Chrome with debugging (PowerShell terminal in VS Code):
//        & "C:\Program Files\Google\Chrome\Application\chrome.exe" `
//            --remote-debugging-port=9222 `
//            --user-data-dir="C:\Temp\chrome-cdp" `
//            https://dev.chipy.com/shop
//   2) In that window, pass Cloudflare if asked and wait for the shop to load.
//   3) Run the tests (one worker – these tests share one logged-in browser):
//        npx playwright test shop/chipy-shop-elem-present-buy-load-more.spec.js --workers=1
//
// NOTE ON STATE: several tests here log in as `faneisback` and Tests 7 & 8
// actually BUY items (bonuses are rate-limited to 1 purchase / day, avatars can
// only be bought once). Re-running the buy tests may therefore hit "already
// purchased" / "not enough coins" states – the buy tests are written to skip
// items that cannot be purchased and pick another one.
// =============================================================================
const { test, expect } = require("../fixtures");

const SHOP_URL = "https://dev.chipy.com/shop";

// Credentials for the account under test.
const USERNAME = "faneisback";
const PASSWORD = "q1w2e3r4";

// The "active" category-tab colour used by the avatar editor (#fe9124).
const ACTIVE_COLOR_RGB = "rgb(254, 145, 36)";

// The "Available Items" section holds the cards, the results counter and the
// "Load More" button. Scoped by data-section so the separate "Sold Out Items"
// section (data-section="soldOut") is never touched.
const availableSel = 'section.shop-main-section[data-section="available"]';

// ---------------------------------------------------------------------------
// SHARED HELPERS
// ---------------------------------------------------------------------------

// Turn "1,351" / "300" / "Level 7+" into a plain integer (strips everything
// that is not a digit). Returns NaN when there is no number.
function toInt(text) {
  const digits = (text || "").replace(/[^\d]/g, "");
  return digits.length ? parseInt(digits, 10) : NaN;
}

// From a URL like "/public/images/users/body/chip1.png" return "chip1"
// (the last path segment without its ".png" extension). This is the part the
// spec calls the "variable" bit of the avatar image (chip1 / head1 / ...).
function fileBase(url) {
  const m = (url || "").match(/([^/]+)\.png/i);
  return m ? m[1] : null;
}

// Read the four avatar-layer image names from the small user logo in the
// header. Each layer's style is `background-image: url(.../<name>.png)` and we
// return { body, head, eyes, mouth } as those <name> strings.
async function readUserAvatar(page) {
  return page.evaluate(() => {
    const base = (sel) => {
      const el = document.querySelector(sel);
      const style = el ? el.getAttribute("style") || "" : "";
      const m = style.match(/([^/]+)\.png/i);
      return m ? m[1] : null;
    };
    return {
      body: base("#user_img > a > span > span.avatar_small.body.avatar_layer"),
      head: base("#user_img > a > span > span.avatar_small.head.avatar_layer"),
      eyes: base("#user_img > a > span > span.avatar_small.eyes.avatar_layer"),
      mouth: base("#user_img > a > span > span.avatar_small.mouth.avatar_layer"),
    };
  });
}

// Current experience level and coin balance of the logged-in user.
async function readLevel(page) {
  return toInt(await page.locator("#user_exp_level_star_number").textContent());
}
async function readCoins(page) {
  return toInt(await page.locator("#coin_balace_span").textContent());
}

// Log in as faneisback if not already logged in.
//
// The login popup is fetched over AJAX when the "Log in" opener is clicked, and
// on this dev server that first click is sometimes swallowed. So we click the
// opener in a retry loop until the username field actually appears, exactly the
// "click-until-it-sticks" pattern the other shop tests use.
async function ensureLoggedIn(page) {
  // Already logged in? The header shows the user avatar (#user_img).
  if (await page.locator("#user_img").count()) return;

  // Per the spec: check whether anything inside div.log-out reads "Log in".
  const logOut = page.locator("div.log-out");
  const hasLogin = (await logOut.locator("text=Log in").count()) > 0;
  expect(hasLogin, 'expected a "Log in" control inside div.log-out').toBe(true);

  const opener = page.locator("div.log-out__open");
  const userInput = page.locator("#login_input_username");

  await expect(async () => {
    if (!(await userInput.isVisible().catch(() => false))) {
      await opener.first().click().catch(() => {});
    }
    await expect(userInput).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });

  // Fill the credentials and submit.
  await userInput.fill(USERNAME);
  await page.locator("#login_input_password").fill(PASSWORD);
  await page.locator("button.login_exec").click();

  // Login is done once the header avatar is present.
  await page.locator("#user_img").waitFor({ state: "attached", timeout: 20000 });
  await expect(page.locator("#hello_user")).toHaveText(USERNAME, { timeout: 10000 });
}

// Click "Load More" in the Available Items section until it disappears, so
// every card is rendered. The handler binds lazily, so a click can be swallowed
// – clicking again is harmless, so we keep clicking while the button is visible.
async function loadAllAvailable(page) {
  const loadMore = page.locator(`${availableSel} button.shop-load-more`);
  await expect(async () => {
    if (await loadMore.isVisible().catch(() => false)) {
      // A leftover system-message popup (this Chrome keeps state between runs)
      // can sit over the button and swallow the click, so clear it first.
      await closeSystemMessage(page);
      await loadMore.scrollIntoViewIfNeeded().catch(() => {});
      await loadMore.click().catch(() => {});
      await page.waitForTimeout(500); // let the next batch render
    }
    await expect(loadMore).toBeHidden({ timeout: 1500 });
  }).toPass({ timeout: 60000 });
}

// Close any open "system message" popup (the small error/confirmation toast).
async function closeSystemMessage(page) {
  await page.evaluate(() => {
    if (typeof window.remove_system_message === "function") {
      window.remove_system_message();
    }
    const x = document.querySelector(
      "div.system_msg_container_main_div .system_message_close_spn_btn",
    );
    if (x) x.click();
  });
  await page
    .locator("div.system_msg_container_main_div")
    .waitFor({ state: "hidden", timeout: 5000 })
    .catch(() => {});
}

// =============================================================================
// TEST 1 – LOG IN + READ THE USER'S AVATAR, LEVEL AND COINS
// =============================================================================
test("Test 1 - Log in and read user avatar, level and coins", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });

  await ensureLoggedIn(page);

  // Store the four avatar-layer image names (chip1 / head1 / eyes1 / mouth1 …).
  const avatar = await readUserAvatar(page);
  console.log("Avatar layers:", avatar);
  expect(avatar.body, "avatarBody").toBeTruthy();
  expect(avatar.head, "avatarHead").toBeTruthy();
  expect(avatar.eyes, "avatarEyes").toBeTruthy();
  expect(avatar.mouth, "avatarMouth").toBeTruthy();

  // Store the user's level and coin balance.
  const level = await readLevel(page);
  const coins = await readCoins(page);
  console.log(`User level: ${level}, coins: ${coins}`);
  expect(Number.isNaN(level)).toBe(false);
  expect(Number.isNaN(coins)).toBe(false);
});

// =============================================================================
// TEST 2 – "LOAD MORE" LOADS EVERY ITEM (data-total === counter === rendered)
// =============================================================================
test("Test 2 - Load More renders every item and the three totals match", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);

  const loadMore = page.locator(`${availableSel} button.shop-load-more`);
  const counter = page.locator(`${availableSel} .shop-manage-panel__total span`);
  const cards = page.locator(`${availableSel} .shop-main-section__list article.shop-card`);

  // 1) data-total attribute on the "Load More" button (the true total).
  await loadMore.waitFor({ state: "attached", timeout: 15000 });
  const dataTotal = toInt(await loadMore.getAttribute("data-total"));

  // 2) the results counter shown in the manage panel.
  const counterTotal = toInt(await counter.textContent());

  console.log(`data-total=${dataTotal}, counter=${counterTotal}`);

  // Click "Load More" until it disappears – now every card is on the page.
  await loadAllAvailable(page);

  // 3) the number of cards actually rendered.
  const renderedCount = await cards.count();
  console.log(`rendered cards=${renderedCount}`);

  // All three numbers must be equal.
  expect(counterTotal).toBe(dataTotal);
  expect(renderedCount).toBe(dataTotal);
});

// =============================================================================
// TEST 3 – EVERY CARD SHOWS ALL THE EXPECTED ELEMENTS
// =============================================================================
// For each card we assert the presence of: logo image, title, coins icon + a
// coins number, level icon + a level number, the "Buy Now" button and both the
// "sold" and "available" footer badges (icon + number + label).
test("Test 3 - Every card has logo, title, stats, buy button and sold/available badges", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);

  // Make sure every card is on the page before we validate them.
  await loadAllAvailable(page);

  // Validate all cards in one pass in the browser (much faster than hundreds of
  // individual round-trips) and return a per-card report of anything missing.
  const report = await page.evaluate((sel) => {
    const section = document.querySelector(sel);
    const cards = [...section.querySelectorAll(".shop-main-section__list article.shop-card")];
    const problems = [];

    cards.forEach((c, i) => {
      const miss = [];

      // Logo image (has a real src).
      const logo = c.querySelector(".shop-card__logo img");
      if (!logo || !(logo.getAttribute("src") || logo.getAttribute("data-src"))) miss.push("logo");

      // Title link with text.
      const title = c.querySelector("h3.shop-card__title a");
      if (!title || !title.textContent.trim()) miss.push("title");

      // Stats: span 1 = coins (img + number), span 2 = level (img + number).
      const coinSpan = c.querySelector(".shop-card__stats span:nth-child(1)");
      if (!coinSpan || !coinSpan.querySelector("img")) miss.push("coins-icon");
      if (!coinSpan || !/\d/.test(coinSpan.textContent)) miss.push("coins-number");

      const lvlSpan = c.querySelector(".shop-card__stats span:nth-child(2)");
      if (!lvlSpan || !lvlSpan.querySelector("img")) miss.push("level-icon");
      if (!lvlSpan || !/\d/.test(lvlSpan.textContent)) miss.push("level-number");

      // Buy Now button.
      const buy = c.querySelector("button.shop-buy-button");
      if (!buy || !buy.textContent.trim()) miss.push("buy-button");

      // Footer: sold badge (span 1) and available badge (span 2), each icon+text.
      const sold = c.querySelector(".shop-card__bottom span:nth-child(1)");
      if (!sold || !sold.querySelector("img") || !/sold/i.test(sold.textContent)) miss.push("sold");

      const avail = c.querySelector(".shop-card__bottom span:nth-child(2)");
      if (!avail || !avail.querySelector("img") || !/available/i.test(avail.textContent))
        miss.push("available");

      if (miss.length) problems.push({ index: i + 1, title: title ? title.textContent.trim() : "?", missing: miss });
    });

    return { total: cards.length, problems };
  }, availableSel);

  console.log(`Checked ${report.total} cards; ${report.problems.length} with problems.`);
  if (report.problems.length) console.log(JSON.stringify(report.problems, null, 2));

  expect(report.total).toBeGreaterThan(0);
  expect(report.problems, "cards missing required elements").toEqual([]);
});

// =============================================================================
// TEST 4 – THE INFO ICON SHOWS ITS POPUP ON HOVER
// =============================================================================
// Find the FIRST card that actually has an info icon (button.shop-card__tooltip)
// – the first card in the list is not guaranteed to have one. The popup text
// lives in the trigger's URL-encoded `data-description` and is shown by a
// Tooltipster popup on hover (binds lazily + hover-intent, so we re-hover).
test("Test 4 - Hovering a card's info icon shows its description popup", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);

  // First card carrying an info icon, within the Available Items section.
  const infoTrigger = page
    .locator(`${availableSel} article.shop-card button.shop-card__tooltip`)
    .first();
  await expect(infoTrigger).toBeVisible({ timeout: 15000 });
  await infoTrigger.scrollIntoViewIfNeeded();

  // The expected popup text: decode the data-description and strip its quotes.
  const raw = await infoTrigger.getAttribute("data-description");
  const description = decodeURIComponent(raw || "").replace(/^"|"$/g, "").trim();
  expect(description.length, "info popup has some text").toBeGreaterThan(0);

  // Hover to open the Tooltipster popup; re-hover until it shows.
  const popup = page.locator(".tooltipster-base");
  await expect(async () => {
    await page.mouse.move(0, 0);
    await infoTrigger.hover();
    await expect(popup).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15000 });

  // The popup shows this item's description text.
  await expect(popup).toContainText(description.slice(0, 30));
});

// =============================================================================
// TEST 5 – "TRY IT!" PREVIEWS THE ITEM ON THE BIG AVATAR + EDITOR TABS
// =============================================================================
// Find the FIRST card that has a "Try It!" control (only avatar items have one,
// and which card is first can change over time). From its logo read:
//   itemType  = the logo's data-type   (body | head | eyes | mouth)
//   itemName  = the file name of the logo's data-src, without folder or ".png"
// Click "Try It!" (the first click is sometimes swallowed, so we retry until
// #edit_avatar_container opens), then confirm the matching big-avatar layer's
// image contains itemName, and exercise the editor's category tabs
// (active class + #fe9124 text colour).
test("Test 5 - Try It! previews the item on the big avatar and switches editor tabs", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);

  // First card with a "Try It!" control.
  const tryCard = page
    .locator(`${availableSel} article.shop-card`)
    .filter({ has: page.locator("span.shop-card__try-it") })
    .first();
  await expect(tryCard).toBeVisible({ timeout: 15000 });
  await tryCard.scrollIntoViewIfNeeded();

  // The real logo image carries data-type (a lazy-load placeholder image sits
  // in the same link but has no data-type), so scope to img[data-type].
  const logo = tryCard.locator(".shop-card__logo img[data-type]");
  const itemType = await logo.getAttribute("data-type"); // e.g. "mouth"
  const itemName = fileBase(await logo.getAttribute("data-src")); // e.g. "AvatarsNavyBlueAlchemistaMouth2"
  console.log(`Trying item -> type=${itemType}, name=${itemName}`);
  expect(itemName, "itemName parsed from data-src").toBeTruthy();

  // Click "Try It!" and wait for the avatar editor to open. The editor is built
  // lazily, so retry the click until #edit_avatar_container is present.
  const tryBtn = tryCard.locator("span.shop-card__try-it");
  const editContainer = page.locator("#edit_avatar_container");
  await expect(async () => {
    if (!(await editContainer.count())) await tryBtn.click().catch(() => {});
    await expect(editContainer).toHaveCount(1, { timeout: 2000 });
  }).toPass({ timeout: 30000 });

  // Each big-avatar layer applies its picture via an inline
  // `style="background-image: url(...)"`. When the editor opens it first shows
  // the user's current avatar and the tried item is applied a moment later, so
  // we poll the layer matching itemType until it carries the tried item.
  const layerUrl = (type) =>
    page.evaluate((t) => {
      const el = document.querySelector(
        `#big_avatar_li > div > span > span.avatar_extra_big.${t}.avatar_layer`,
      );
      const style = el ? el.getAttribute("style") || "" : "";
      const m = style.match(/url\((['"]?)(.*?)\1\)/i);
      return m ? m[2] : "";
    }, type);

  await expect
    .poll(() => layerUrl(itemType), { timeout: 15000 })
    .toContain(itemName);

  console.log("Big avatar layers:", {
    body: await layerUrl("body"),
    head: await layerUrl("head"),
    eyes: await layerUrl("eyes"),
    mouth: await layerUrl("mouth"),
  });

  // The editor's category tabs. When the editor opens, the "body" tab is active
  // (has the .active class and the #fe9124 text colour).
  const bodyTab = page.locator("#avatar_cat_right_wing_li_body");
  const headTab = page.locator("#avatar_cat_right_wing_li_head");

  await expect(bodyTab).toHaveClass(/\bactive\b/);
  await expect(bodyTab).toHaveCSS("color", ACTIVE_COLOR_RGB);

  // Click the "head" tab: it becomes active and orange...
  await headTab.click();
  await expect(headTab).toHaveClass(/\bactive\b/);
  await expect(headTab).toHaveCSS("color", ACTIVE_COLOR_RGB);

  // ...and the "body" tab is no longer active / no longer orange.
  await expect(bodyTab).not.toHaveClass(/\bactive\b/);
  await expect(bodyTab).not.toHaveCSS("color", ACTIVE_COLOR_RGB);
});

// =============================================================================
// TEST 6 – FORBIDDEN BUYS (not enough coins / level too low)
// =============================================================================
test("Test 6 - Buying an unaffordable / level-locked item shows the right error", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);
  await loadAllAvailable(page);

  const cards = page.locator(`${availableSel} .shop-main-section__list article.shop-card`);
  const sysMsg = page.locator("div.system_msg_container_main_div > div");

  // ---- 6a) An item costing at least 10 000 coins -> "not enough coins" -------
  const expensiveIndex = await page.evaluate((sel) => {
    const list = [...document.querySelectorAll(`${sel} article.shop-card`)];
    return list.findIndex((c) => {
      const coins = parseInt((c.querySelector(".shop-card__stats span:nth-child(1)")?.textContent || "").replace(/[^\d]/g, ""), 10);
      return coins >= 10000;
    });
  }, availableSel);
  expect(expensiveIndex, "a card costing >= 10000 coins exists").toBeGreaterThanOrEqual(0);

  await cards.nth(expensiveIndex).locator("button.shop-buy-button").scrollIntoViewIfNeeded();
  await cards.nth(expensiveIndex).locator("button.shop-buy-button").click();

  await expect(sysMsg).toBeVisible({ timeout: 15000 });
  await expect(sysMsg).toContainText("You do not have enough CHIPY coins to buy this item.");
  await closeSystemMessage(page);

  // ---- 6b) An item that needs level 20+ -> "experience level below minimum" --
  const lockedIndex = await page.evaluate((sel) => {
    const list = [...document.querySelectorAll(`${sel} article.shop-card`)];
    return list.findIndex((c) => {
      const m = (c.querySelector(".shop-card__stats span:nth-child(2)")?.textContent || "").match(/Level\s*(\d+)/);
      return m && parseInt(m[1], 10) >= 20;
    });
  }, availableSel);
  expect(lockedIndex, "a card requiring level 20+ exists").toBeGreaterThanOrEqual(0);

  await cards.nth(lockedIndex).locator("button.shop-buy-button").scrollIntoViewIfNeeded();
  await cards.nth(lockedIndex).locator("button.shop-buy-button").click();

  await expect(sysMsg).toBeVisible({ timeout: 15000 });
  await expect(sysMsg).toContainText(
    "Your experience level is below the minimum level required to buy this item.",
  );
  await closeSystemMessage(page);
});

// =============================================================================
// TEST 7 – BUY A BONUS
// =============================================================================
// Collect every card whose logo has the ".bonus" class and is eligible (costs
// <= 500 coins AND its required level is at or below the user's level). Try the
// eligible bonuses in random order until one is actually buyable (a few are
// already bought today – 1 purchase / day), then buy just that one: fill the
// username field ("test buy") if the confirmation asks for one, confirm with
// "Yes - Buy Now", expect "Request Submitted!", print the bought bonus's name
// (its <h3>) and check the coin balance dropped by the item's cost. If none is
// buyable right now we skip.
test("Test 7 - Buy a bonus item", async ({ page }) => {
  test.setTimeout(150000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);
  await loadAllAvailable(page);

  const userLevel = await readLevel(page);

  // Build the candidate list of affordable, level-eligible bonus cards.
  const candidates = await page.evaluate(
    ({ sel, userLevel }) => {
      const list = [...document.querySelectorAll(`${sel} article.shop-card`)];
      const out = [];
      list.forEach((c, i) => {
        const logo = c.querySelector(".shop-card__logo img[data-type]");
        if (!logo || !logo.classList.contains("bonus")) return;
        const cost = parseInt((c.querySelector(".shop-card__stats span:nth-child(1)")?.textContent || "").replace(/[^\d]/g, ""), 10);
        const lm = (c.querySelector(".shop-card__stats span:nth-child(2)")?.textContent || "").match(/Level\s*(\d+)/);
        const reqLevel = lm ? parseInt(lm[1], 10) : 999;
        const name = c.querySelector("h3.shop-card__title a")?.textContent?.trim();
        if (cost <= 500 && reqLevel <= userLevel) out.push({ index: i, name, cost, reqLevel });
      });
      return out;
    },
    { sel: availableSel, userLevel },
  );
  console.log(`Bonus candidates (<=500 coins, level<=${userLevel}):`, candidates.length);
  expect(candidates.length, "at least one eligible bonus card").toBeGreaterThan(0);

  const cards = page.locator(`${availableSel} .shop-main-section__list article.shop-card`);
  // Clicking "Buy Now" opens a "Yes - Buy Now" confirmation inside the
  // system-message popup. The confirm button carries both classes; this exact
  // selector matches it whether or not the confirmation also has a username
  // field. When the item is not buyable (daily limit already reached) the popup
  // holds an error message instead and no confirm button appears.
  const confirmBtn = page.locator(
    "div.system_msg_container_main_div span.confirm-buy-btn.buy-btn",
  );
  const sysText = async () =>
    (await page.locator("div.system_msg_container_main_div").textContent().catch(() => "")) || "";

  // Some eligible bonuses are already bought today (1 purchase / day). Try the
  // eligible ones in random order until one is actually buyable, then buy just
  // that one. A non-buyable bonus only flashes a small error message (no
  // confirmation dialog), so this is NOT the "open dozens of dialogs" case.
  const order = [...candidates].sort(() => Math.random() - 0.5);

  let bought = false;
  for (const cand of order) {
    // The bonus card's title (its <h3>), read fresh from the card.
    const bonusName = (
      await cards.nth(cand.index).locator("h3.shop-card__title a").textContent()
    )?.trim();
    const coinsBefore = await readCoins(page);

    const buy = cards.nth(cand.index).locator("button.shop-buy-button");
    await buy.scrollIntoViewIfNeeded();
    await buy.click();

    // Buyable => the "Yes - Buy Now" confirmation shows. Otherwise it's an error
    // (e.g. daily limit) => close it and try the next eligible bonus.
    const confirmed = await confirmBtn
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (!confirmed) {
      console.log(`"${bonusName}" nu poate fi cumparat acum (${(await sysText()).replace(/\s+/g, " ").trim()})`);
      await closeSystemMessage(page);
      continue;
    }

    // If the confirmation asks for a username, fill it with "test buy".
    const modalInput = page.locator("div.system_msg_container_main_div input");
    if (await modalInput.first().isVisible().catch(() => false)) {
      await modalInput.first().fill("test buy");
    }

    // Confirm the purchase and wait for the success message. Different bonus
    // types report success differently: request-style bonuses (the ones with a
    // username field) show "Request Submitted!", while direct bonuses show
    // "Congratulations! You have purchased this bonus.".
    await confirmBtn.click();
    await expect
      .poll(
        async () => /Request Submitted!|purchased this bonus|Congratulations!/i.test(await sysText()),
        { timeout: 15000 },
      )
      .toBe(true);
    await closeSystemMessage(page);

    // Print the name of the bonus card we just bought.
    console.log(`Bonus cumparat: ${bonusName}`);

    // The coin balance must have dropped by exactly the item's cost.
    await expect
      .poll(async () => await readCoins(page), { timeout: 15000 })
      .toBe(coinsBefore - cand.cost);

    bought = true;
    break;
  }

  if (!bought) {
    test.skip(true, "Niciun bonus eligibil nu e cumparabil acum (toate cumparate azi)");
  }
});

// =============================================================================
// TEST 8 – BUY AN AVATAR
// =============================================================================
// Collect every card whose logo has the ".avatar" class, pick ONE random card
// that costs <= 500 coins AND requires a level below the user's level, and try
// to buy just that one. If its "Yes - Buy Now" confirmation shows: capture the
// logo's data-src (itemNameBuy), confirm, expect "Congratulations!", then
// re-read the user's avatar layers and confirm itemNameBuy shows up in one of
// them. If no confirmation appears (item already owned) we log
// "Nu a fost gasit niciun bonus" and skip – we do NOT click through every card.
test("Test 8 - Buy an avatar and see it applied to the user", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page);
  await loadAllAvailable(page);

  const userLevel = await readLevel(page);

  // Candidate avatar cards: cost <= 500 and required level below the user's.
  const candidates = await page.evaluate(
    ({ sel, userLevel }) => {
      const list = [...document.querySelectorAll(`${sel} article.shop-card`)];
      const out = [];
      list.forEach((c, i) => {
        const logo = c.querySelector(".shop-card__logo img[data-type]");
        if (!logo || !logo.classList.contains("avatar")) return;
        const cost = parseInt((c.querySelector(".shop-card__stats span:nth-child(1)")?.textContent || "").replace(/[^\d]/g, ""), 10);
        const lm = (c.querySelector(".shop-card__stats span:nth-child(2)")?.textContent || "").match(/Level\s*(\d+)/);
        const reqLevel = lm ? parseInt(lm[1], 10) : 999;
        const name = c.querySelector("h3.shop-card__title a")?.textContent?.trim();
        if (cost <= 500 && reqLevel <= userLevel) out.push({ index: i, name, cost, reqLevel });
      });
      return out;
    },
    { sel: availableSel, userLevel },
  );
  console.log(`Avatar candidates (<=500 coins, level<=${userLevel}):`, candidates.length);

  const cards = page.locator(`${availableSel} .shop-main-section__list article.shop-card`);
  // "Buy Now" opens the same system-message confirmation as bonuses, with a
  // "Yes - Buy Now" button (span.confirm-buy-btn.buy-btn). No confirm button =>
  // the item cannot be bought (already owned / level / coins).
  const confirmBtn = page.locator("div.system_msg_container_main_div span.confirm-buy-btn.buy-btn");
  const sysText = async () =>
    (await page.locator("div.system_msg_container_main_div").textContent().catch(() => "")) || "";

  expect(candidates.length, "at least one eligible avatar card").toBeGreaterThan(0);

  // Pick ONE random eligible avatar and try to buy just that one card.
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  console.log(`Picked avatar "${pick.name}" (cost ${pick.cost}, level ${pick.reqLevel}+)`);

  // Capture the item's image (data-src) before buying – this is itemNameBuy.
  const itemNameBuy = await cards
    .nth(pick.index)
    .locator(".shop-card__logo img[data-type]")
    .getAttribute("data-src");

  const buy = cards.nth(pick.index).locator("button.shop-buy-button");
  await buy.scrollIntoViewIfNeeded();
  await buy.click();

  // Wait for the "Yes - Buy Now" confirmation. If it never shows, this item is
  // most likely already owned by the account, so we stop here instead of
  // clicking through every other card.
  const confirmed = await confirmBtn
    .waitFor({ state: "visible", timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (!confirmed) {
    console.log(`Nu a fost gasit niciun bonus (${(await sysText()).replace(/\s+/g, " ").trim()})`);
    await closeSystemMessage(page);
    test.skip(true, `"${pick.name}" nu este cumparabil (probabil deja detinut)`);
    return;
  }

  console.log(`Buying avatar "${pick.name}", data-src=${itemNameBuy}`);
  await confirmBtn.click();
  await expect.poll(sysText, { timeout: 15000 }).toContain("Congratulations!");
  await closeSystemMessage(page);

  // Re-read the user's four avatar-layer images (as in Test 1) and confirm the
  // just-bought item now shows up in one of them.
  const boughtBase = fileBase(itemNameBuy);
  await expect
    .poll(
      async () => {
        const a = await readUserAvatar(page);
        return [a.body, a.head, a.eyes, a.mouth].some((v) => v && v.includes(boughtBase));
      },
      { timeout: 15000 },
    )
    .toBe(true);
});
