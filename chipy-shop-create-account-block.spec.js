const { test, expect } = require("../../_cdp");
const SHOP_URL = "https://dev.chipy.com/shop";
//test???

// This file ONLY covers the "Create an Account" warning note that the shop page
// shows to logged-out visitors:
//test
//   <dialog class="shop-warning-note" open>
//     <form method="dialog">
//       <h3>Note: To Purchase Shop Items you Need an Account</h3>
//       <p>...</p>
//       <button class="shop-warning-note__create-btn" data-trigger="register-popup">Create a Free Account</button>
//       <button class="shop-warning-note__close" aria-label="Close button"><img ...></button>
//     </form>
//   </dialog>
//
// NOTE ON THE REGISTER POPUP:
// The "Create a Free Account" button carries data-trigger="register-popup",
// which opens the registration popup (#register_content). This works on the
// current dev build: clicking the button shows #register_content, and the popup
// is closed via its `.btn-close` control. The full open -> close popup ->
// close note flow is covered by the third test below.
// ---------------------------------------------------------------------------
test.describe("Chipy Shop - create account warning note", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SHOP_URL, { waitUntil: "domcontentloaded" });
  });

  // ---------------------------------------------------------------------------
  // 1) THE WARNING NOTE IS SHOWN BY DEFAULT
  // ---------------------------------------------------------------------------
  // For a logged-out user the <dialog> renders with the `open` attribute, so it
  // is visible. We assert the dialog, its heading, copy and the two buttons.
  test("Warning note dialog is visible with the expected content", async ({
    page,
  }) => {
    const note = page.locator("dialog.shop-warning-note");

    // The dialog is rendered open/visible.
    await expect(note).toBeVisible();
    // Native <dialog> exposes its open state via the `open` attribute.
    await expect(note).toHaveAttribute("open", "");

    // Heading + intro copy.
    await expect(note.locator("h3")).toHaveText(
      "Note: To Purchase Shop Items you Need an Account",
    );
    await expect(note).toContainText(
      "Create an account (it’s FREE), collect coins by being active on our website",
    );

    // The primary "Create a Free Account" button (triggers the register popup).
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
  //   - "Create a Free Account" opens the register popup (#register_content).
  //   - Closing the popup via its `.btn-close` control hides it, while the
  //     warning note stays underneath.
  //   - Closing the note via its X then dismisses the note.
  test("Create account button opens register popup; closing popup then note dismisses note", async ({
    page,
  }) => {
    const note = page.locator("dialog.shop-warning-note");
    await expect(note).toBeVisible();

    // Open the register popup from the note CTA. The page binds the
    // register-popup handler lazily, so the very first click can be swallowed.
    // Click only while the popup is not yet open and retry until it appears.
    const registerPopup = page.locator("#register_content");
    await expect(async () => {
      if (!(await registerPopup.isVisible())) {
        await note.locator(".shop-warning-note__create-btn").click();
      }
      await expect(registerPopup).toBeVisible();
    }).toPass({ timeout: 15000 });

    // Close the register popup via its close (X) control. The close handler is
    // also bound lazily, so retry the click until the popup is actually hidden.
    await expect(async () => {
      if (await registerPopup.isVisible()) {
        await registerPopup.locator(".btn-close").first().click();
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
