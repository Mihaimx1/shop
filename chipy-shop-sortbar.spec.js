const { test, expect } = require('./cdp-fixtures');
const SHOP_URL = 'https://dev.chipy.com/shop';

// "Relevant" and "Newest" expose no ordering key in the DOM, so for those we
// only assert the option gets selected and the whole list still loads.
const SORTS = [
  { orderBy: 'relevant',   label: 'Relevant' },
  { orderBy: 'price-asc',  label: 'Price: Low to High',             metric: 'coins', dir: 'asc'  },
  { orderBy: 'price-desc', label: 'Price: High to Low',             metric: 'coins', dir: 'desc' },
  { orderBy: 'level-asc',  label: 'Level Requirement: Low to High', metric: 'level', dir: 'asc'  },
  { orderBy: 'level-desc', label: 'Level Requirement: High to Low', metric: 'level', dir: 'desc' },
  { orderBy: 'popular',    label: 'Most Popular',                   metric: 'sold',  dir: 'desc' },
  { orderBy: 'newest',     label: 'Newest' },
];

test.describe('Chipy Shop - sort bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  });

  for (const sort of SORTS) {
    test(`Sort "${sort.label}" orders the main list correctly`, async ({ page }) => {
      const sortWrap = page.locator('#sort-shop-wrap');
      const sortTxt  = sortWrap.locator('#sort-txt');
      const option   = sortWrap.locator(`fieldset[data-order-by="${sort.orderBy}"]`);

      // The "Available Items" section owns the cards, the counter and Load More.
      const availableSection = page.locator('section.shop-main-section', {
        has: page.locator('.shop-manage-panel'),
      });
      const loadMore = availableSection.locator('button.shop-load-more');
      const counter  = availableSection.locator('.shop-manage-panel__total span');
      const cards    = availableSection.locator('article.shop-card:visible');

      // Sort popup is toggled via `visibility` (it stays display:block).
      const sortPopupOpen = () => page.evaluate(() =>
        getComputedStyle(document.querySelector('#sort-shop-wrap .filter_popup')).visibility === 'visible'
      );

      // ---- OPEN THE SORT POPUP AND SELECT THE OPTION ----------------------
      // One self-healing block: ensure the popup is open, then click the option
      // only while it isn't selected yet. Reopening on each retry click without ever toggling the popup/option back.
      await expect(async () => {
        if (!(await sortPopupOpen())) await sortTxt.click();
        if ((await option.getAttribute('data-selected')) !== 'true') await option.click();
        await expect(option).toHaveAttribute('data-selected', 'true');
      }).toPass({ timeout: 15000 });

      // The sort-bar label reflects the chosen option.
      await expect(sortTxt).toHaveText(sort.label);

      // ---- LOAD EVERY ITEM SO THE WHOLE SORTED LIST IS PRESENT ------------
      while (await loadMore.isVisible().catch(() => false)) {
        await loadMore.click().catch(() => {});
        await page.waitForTimeout(600);
      }

      // The full list is loaded (matches the results counter).
      const expectedCount = parseInt((await counter.innerText()).trim(), 10);
      expect(expectedCount).toBeGreaterThan(0);
      await expect(cards).toHaveCount(expectedCount);

      // ---- OBJECTIVE SORTS: ASSERT THE ORDER ------------------------------
      if (sort.metric) {
        const values = await cards.evaluateAll((els, metric) => els.map((c) => {
          const stats = c.querySelectorAll('.shop-card__stats span');
          if (metric === 'coins') {
            return parseInt((stats[0]?.textContent || '').replace(/\D/g, ''), 10);
          }
          if (metric === 'level') {
            const m = (stats[1]?.textContent || '').match(/(\d+)/);
            return m ? parseInt(m[1], 10) : NaN;
          }
          // sold ("Most Popular")
          const sold = [...c.querySelectorAll('.shop-card__bottom span')]
            .find((s) => /sold/i.test(s.textContent));
          return sold ? parseInt(sold.textContent.replace(/\D/g, ''), 10) : NaN;
        }), sort.metric);

        // Every card yielded a real number...
        expect(values.length).toBe(expectedCount);
        expect(values.every((v) => Number.isFinite(v))).toBe(true);
        // ...and the sequence is ordered in the expected direction.
        const ordered = values.every(
          (v, i) => i === 0 || (sort.dir === 'asc' ? v >= values[i - 1] : v <= values[i - 1]),
        );
        expect(ordered, `${sort.label}: not ${sort.dir}-ordered -> ${values.join(', ')}`).toBe(true);
      }
    });
  }
});
