const { test, expect } = require('./cdp-fixtures');
const { ensureLoggedIn } = require('./chipy-auth');

// ---------------------------------------------------------------------------
const ITEM_URL = 'https://dev.chipy.com/item-name/311-free-spins-test';
const CREDENTIALS = { username: 'crosby54', password: 'q1w2e3r4' };

// The submit button is bound but kept visually hidden by the site, so we fire
// its click handler directly (mirrors how the page itself submits).
async function submitComment(page) {
  await page.locator('.add-comment-form-simple__submit').dispatchEvent('click');
}

// Opens the comment editor and returns the CKEditor editable + counter locators.
// The comment box is a CKEditor that is wired up ("Add new comment" reveals the
// editable) only once the large deferred JS bundle has run, so the click is
// retried until the editable appears; then we wait for CKEditor to be ready.
async function openCommentEditor(page) {
  const addBtn = page.locator('.shop-comments__add-comment').first();
  await expect(addBtn).toBeVisible();

  const editable = page.locator('.add-comment-form-simple--shop .cke_editable');
  await expect(async () => {
    await addBtn.click({ force: true }); // sticky header can intercept a plain click
    await expect(editable).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000 });

  await page.waitForFunction(
    () =>
      window.CKEDITOR &&
      CKEDITOR.instances['shop-message'] &&
      CKEDITOR.instances['shop-message'].status === 'ready',
    null,
    { timeout: 15000 },
  );

  const counter = page.locator('.add-comment-form-simple--shop .characters-left');
  return { editable, counter };
}

test.describe('Chipy single item - leave a comment (logged in)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ITEM_URL, { waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page, CREDENTIALS);
  });

  // ---------------------------------------------------------------------------
  // 1) THE COMMENT FIELDS ARE PRESENT AND THE CHARACTER COUNTER WORKS
  // ---------------------------------------------------------------------------
  test('Comment form shows the editor and a live character counter', async ({ page }) => {
    const { editable, counter } = await openCommentEditor(page);

    // Starts at the 25-character minimum.
    await expect(counter).toBeVisible();
    await expect(counter).toHaveText(/25\s+characters left/i);

    // Typing counts down (25 - 5 = 20).
    await editable.click({ force: true });
    await page.keyboard.type('hello', { delay: 15 });
    await expect(counter).toHaveText(/20\s+characters left/i);
  });

  // ---------------------------------------------------------------------------
  // 2) A COMMENT SHORTER THAN 25 CHARACTERS IS REJECTED
  // ---------------------------------------------------------------------------
  test('Submitting fewer than 25 characters is rejected', async ({ page }) => {
    const { editable } = await openCommentEditor(page);
    const commentsBefore = await page.locator('#comments_wrap .comments__wrap').count();

    await editable.click({ force: true });
    await page.keyboard.type('too short', { delay: 15 }); // 9 chars
    await submitComment(page);

    // The editor is flagged with an error and nothing is posted.
    await expect(editable).toHaveClass(/error/);
    await expect(page.locator('#comments_wrap .comments__wrap')).toHaveCount(commentsBefore);
  });

  // ---------------------------------------------------------------------------
  // 3) A VALID COMMENT CAN BE POSTED AND APPEARS AT THE TOP OF THE LIST
  // ---------------------------------------------------------------------------
  test('Logged-in user can leave a comment', async ({ page }) => {
    const { editable } = await openCommentEditor(page);
    const commentsBefore = await page.locator('#comments_wrap .comments__wrap').count();

    // A unique, > 25 char message so we can find exactly our comment afterwards.
    const message = `Automated Playwright comment ${Date.now()} - please ignore, this is a test.`;
    await editable.click({ force: true });
    await page.keyboard.type(message, { delay: 5 });
    await submitComment(page);

    // The new comment is prepended to the list...
    await expect(page.locator('#comments_wrap .comments__wrap')).toHaveCount(commentsBefore + 1);
    const newest = page.locator('#comments_wrap .comments__wrap').first();
    await expect(newest.locator('.comments__txt')).toContainText(message);
    // ...and it is attributed to the logged-in user.
    await expect(newest.locator('.comments__user')).toContainText(CREDENTIALS.username);
  });
});
