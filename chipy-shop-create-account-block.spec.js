const { test, expect } = require('./cdp-fixtures');
const { ensureLoggedOut } = require('./chipy-auth');
const SHOP_URL = "https://dev.chipy.com/shop";

test.describe("Chipy Shop - create account warning note", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
    await ensureLoggedOut(page, SHOP_URL);
  });

  // ---------------------------------------------------------------------------
  // 1) THE WARNING NOTE IS SHOWN BY DEFAULT
  // ---------------------------------------------------------------------------

  test("Warning note dialog is visible with the expected content", async ({
    page,
  }) => {
    const note = page.locator("dialog.shop-warning-note");

    // The dialog is rendered open/visible.
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute("open", "");

    // Heading + intro copy.
    await expect(note.locator("h3")).toHaveText(
      "Note: To Purchase Shop Items you Need an Account",
    );
    await expect(note).toContainText(
      "Create an account (it’s FREE), collect coins by being active on our website",
    );

    // "Create a Free Account" button (triggers the register popup).
    const createBtn = note.locator(".shop-warning-note__create-btn");
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toHaveText("Create a Free Account");
    // It is wired to open the register popup via this data attribute.
    await expect(createBtn).toHaveAttribute("data-trigger", "register-popup");

    // The close (X) button + its icon.
    const closeBtn = note.locator(".shop-warning-note__close");
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toHaveAttribute("aria-label", "Close button");
    await expect(closeBtn.locator("img")).toHaveAttribute("alt", "icon close");
  });

  // ---------------------------------------------------------------------------
  // 2) CLOSING THE NOTE (X) DISMISSES IT
  // ---------------------------------------------------------------------------
  // Clicking the X button closes the <dialog>: the `open` attribute is removed
  // and the note is no longer displayed.
  test("Close (X) button dismisses the warning note", async ({ page }) => {
    const note = page.locator("dialog.shop-warning-note");
    await expect(note).toBeVisible();

    await note.locator(".shop-warning-note__close").click();

    // The dialog is closed: not displayed and no longer `open`.
    await expect(note).toBeHidden();
    await expect(note).not.toHaveAttribute("open", "");
  });

  // ---------------------------------------------------------------------------
  // 3) OPEN REGISTER POPUP, CLOSE IT, THEN CLOSE THE NOTE
  // ---------------------------------------------------------------------------
  test("Create account button opens register popup; closing popup then note dismisses note", async ({
    page,
  }) => {
    const note = page.locator("dialog.shop-warning-note");
    await expect(note).toBeVisible();

    // Open the register popup from the note CTA. The page binds the
    // register-popup handler.
    // Click only while the popup is not yet open and retry until it appears.
    const registerPopup = page.locator("#register_content");
    await expect(async () => {
      if (!(await registerPopup.isVisible())) {
        await note.locator(".shop-warning-note__create-btn").click();
      }
      await expect(registerPopup).toBeVisible();
    }).toPass({ timeout: 15000 });

    // Close the register popup. When it's opened from the shop note its X button
    // isn't wired, but clicking the backdrop (outside the popup content) dismisses
    // it. Retry until the popup is actually hidden.
    await expect(async () => {
      if (await registerPopup.isVisible()) {
        await page.locator(".popup-holder.popup-register").click({ position: { x: 5, y: 5 } });
      }
      await expect(registerPopup).toBeHidden();
    }).toPass({ timeout: 15000 });

    // The warning note is still underneath — close it via its X.
    await expect(note).toBeVisible();
    await note.locator(".shop-warning-note__close").click();

    // The warning note must no longer be displayed.
    await expect(note).toBeHidden();
  });
});
