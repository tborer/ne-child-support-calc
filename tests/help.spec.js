// @ts-check
// Help link + modal on every page, sending through the dev server's fake SMTP.
const { test, expect } = require('@playwright/test');
const { mockConfig } = require('./helpers');

for (const path of ['/', '/calculator.html', '/guidelines.html']) {
  test(`Help sits right after Guidelines on ${path}`, async ({ page }) => {
    await mockConfig(page, { stripe: true });
    await page.goto(path);
    const items = page.locator('.site-nav .nav-inner > *');
    await expect(items.last()).toHaveText('Help');
    await expect(items.nth(-2)).toHaveText('Guidelines');
  });
}

test('sending a help message', async ({ page, request }) => {
  await mockConfig(page, { stripe: true });
  await page.goto('/calculator.html');
  await page.locator('#help-open').click();

  const dialog = page.locator('#help-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#help-message')).toBeFocused();

  // Empty message is caught before sending.
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.locator('.help-status')).toHaveText('Please enter a message.');

  await page.locator('#help-message').fill('Checkout said it could not start.');
  await page.locator('#help-name').fill('Pat');
  await page.locator('#help-email').fill('pat@example.org');
  await dialog.getByRole('button', { name: 'Send message' }).click();
  await expect(dialog.locator('.help-status')).toHaveText('Thanks! Your message has been sent.');
  await expect(page.locator('#help-message')).toHaveValue('');

  const outbox = await (await request.get('/__fake-smtp/outbox')).json();
  const mail = outbox[outbox.length - 1];
  expect(mail.text).toContain('Checkout said it could not start.');
  expect(mail.text).toContain('Page: /calculator.html');
  expect(mail.replyTo).toEqual({ name: 'Pat', address: 'pat@example.org' });

  // Escape closes the dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
