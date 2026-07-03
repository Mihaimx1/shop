const { test, expect } = require('./cdp-fixtures');
const SHOP_URL = 'https://dev.chipy.com/shop';

test.describe('Chipy Shop page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  // ---------------------------------------------------------------------------
  // 1) TITLE -H1 CHECK
  // ---------------------------------------------------------------------------
  //we will check the H1 heading on the shop page to ensure it has the expected text.
  test('H1 heading shows the expected title', async ({ page }) => {
    const heading = page.locator('h1');

    await expect(heading).toHaveText(
      "Let's Shop - Buy Awesome Items with Chipy Coins!"
    );
  });

  // ---------------------------------------------------------------------------
  // 2) UPPER WIDGETS TEXT EXISTS
  // ---------------------------------------------------------------------------
  test('Upper widgets text area is visible and not empty', async ({ page }) => {
    const textArea = page.locator('.tms_text_area_wrap');

    // Assert the block is rendered and visible to the user.
    await expect(textArea).toBeVisible();

    const text = (await textArea.innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 3) READ MORE / READ LESS TOGGLE
  // ---------------------------------------------------------------------------
  // Behaviour on the page:
  //   - By default the text is clamped to 3 lines (CSS -webkit-line-clamp: 3)
  //     and only the "Read More" button is visible.
  //   - After clicking "Read More" the clamp is removed (more than 3 lines are
  //     shown), the "Read More" button hides and the "Read Less" button shows.
  test('Read More expands the text and swaps to Read Less', async ({ page }) => {
    const textArea     = page.locator('.tms_text_area_wrap'); // the clamped copy
    const readMoreBtn  = page.locator('.read_more_btn');      // shown by default
    const readLessBtn  = page.locator('.read_less_btn');      // hidden by default

    // ---- DEFAULT (collapsed) STATE ----------------------------------------
    // "Read More" is visible 
    await expect(readMoreBtn).toBeVisible();
    await expect(readMoreBtn).toHaveText('Read More');
    // ...and "Read Less" is hidden.
    await expect(readLessBtn).toBeHidden();

    // Confirm the copy is clamped to exactly 3 visible lines.
    // we  read the computed CSS and assert the literal clamp rule
    // (`-webkit-line-clamp: 3`) that limits the text to 3 lines.
    const collapsedClamp = await textArea.evaluate(
      (el) => getComputedStyle(el).webkitLineClamp
    );
    expect(collapsedClamp).toBe('3');

    // ---- CLICK "READ MORE" -------------------------------------------------
    await readMoreBtn.click();

    // ---- EXPANDED STATE ----------------------------------------------------
    // The buttons swap: "Read Less" is now visible, "Read More" is hidden.
    await expect(readLessBtn).toBeVisible();
    await expect(readLessBtn).toHaveText('Read Less');
    await expect(readMoreBtn).toBeHidden();

    // The clamp is gone, so the line limit no longer applies.
    const expandedClamp = await textArea.evaluate(
      (el) => getComputedStyle(el).webkitLineClamp
    );
    expect(expandedClamp).toBe('none');
  });

  // ---------------------------------------------------------------------------
  // 4) AFFILIATE DISCLOSURE BLOCK
  // ---------------------------------------------------------------------------
  // Validates the whole `.affiliate-disclosure` block: icon, text and the
  // "Learn more" link pointing to the advertiser-disclosure page.
  test('Affiliate disclosure block is correct', async ({ page }) => {
    const disclosure = page.locator('.affiliate-disclosure');

    await expect(disclosure).toBeVisible();

    // The bell icon: correct source, alt text and dimensions.
    const icon = disclosure.locator('img');
    await expect(icon).toHaveAttribute(
      'src',
      '/public/images/svg/icon-bell-filled.svg'
    );
    await expect(icon).toHaveAttribute('alt', 'bell icon');
    await expect(icon).toHaveAttribute('width', '12');
    await expect(icon).toHaveAttribute('height', '12');

    await expect(disclosure).toContainText('Affiliate Disclosure:');
    await expect(disclosure).toContainText(
      'Using our links to visit and deposit funds may earn us a commission, with no impact on your expenses.'
    );

    // The "Learn more" link: text, target and href.
    const learnMoreLink = disclosure.locator('a.shop');
    await expect(learnMoreLink).toHaveText('Learn more');
    // Opens in a new tab.
    await expect(learnMoreLink).toHaveAttribute('target', '_blank');
    // Points to the advertiser disclosure help page.
    await expect(learnMoreLink).toHaveAttribute(
      'href',
      '/help/advertiser-disclosure'
    );
  });
});
