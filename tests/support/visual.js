// Shared visual-regression helpers for shop screenshots.
//
// This module keeps the visual test stable by hiding UI areas that can change
// between runs (login state, warning dialogs, tooltips, and system messages).
const SHOP_URL = 'https://dev.chipy.com/shop';

async function hideShopDynamicElements(page) {
  await page.addStyleTag({
    content: `
      dialog.shop-warning-note,
      .shop-warning-note,
      .tooltipster-base,
      .system_msg_container_main_div,
      #user_img,
      div.log-out,
      #hello_user,
      #user_exp_level_star_number,
      #coin_balace_span {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  });
}

async function prepareShopVisualPage(page) {
  await page.goto(SHOP_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: "Let's Shop - Buy Awesome Items with Chipy Coins!" }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  await hideShopDynamicElements(page);
}

async function loadShopLazyContent(page) {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.8, 400);
    let position = 0;
    let stableRounds = 0;

    while (stableRounds < 3) {
      const currentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const target = Math.min(position + step, currentHeight);

      window.scrollTo(0, target);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const nextHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );

      if (nextHeight > currentHeight) {
        stableRounds = 0;
      } else {
        stableRounds += 1;
      }

      position = target;

      if (target >= nextHeight) {
        continue;
      }
    }

    window.scrollTo(0, 0);
  });
}

function shopScreenshotOptions() {
  return {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  };
}

module.exports = {
  SHOP_URL,
  hideShopDynamicElements,
  loadShopLazyContent,
  prepareShopVisualPage,
  shopScreenshotOptions,
};
