import { test, expect } from '@playwright/test';

test('journal releases approved articles at the scheduled time and supports direct links', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T16:00:00Z'));
  await page.goto('/#/blog');
  await expect(page.locator('.journal-card')).toHaveCount(1);
  await page.locator('.journal-card a').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your first home clean, without the extra homework');
  await page.goto('/#/blog/standard-or-deep-clean');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('isn’t available yet');
  await page.clock.setFixedTime(new Date('2026-10-01T14:00:01Z'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Standard or Deep Clean');
  await page.goto('/#/blog');
  await expect(page.locator('.journal-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Cleaning guides', exact: true }).click();
  await expect(page.locator('.journal-card')).toHaveCount(1);
});

test('gallery filters and accessible photo viewer work', async ({ page }) => {
  await page.goto('/#/gallery');
  await expect(page.locator('.gallery-grid figure')).toHaveCount(3);
  await expect(page.locator('.gallery-disclosure')).toContainText('not photographs of Asepsis customer projects');
  await page.getByRole('button', { name: 'Bathrooms', exact: true }).click();
  await expect(page.locator('.gallery-grid figure')).toHaveCount(1);
  await page.getByRole('button', { name: 'View A quieter kind of clean' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'All spaces', exact: true }).click();
  await page.getByRole('button', { name: 'View Room for everyday moments' }).click();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.locator('#photo-title')).toHaveText('A quieter kind of clean');
  await page.getByRole('button', { name: 'Close photo' }).click();
});

test('review feedback preserves optional consent and routes by service', async ({ page }) => {
  await page.goto('/#/reviews');
  await expect(page.getByText('Our review collection is getting started.')).toBeVisible();
  await page.getByLabel('Your name').fill('Test Customer');
  await page.getByLabel('Your rating').selectOption('4');
  await page.getByLabel('Your experience').fill('The team was helpful and the visit went smoothly.');
  const consent = page.getByRole('checkbox');
  await expect(consent).not.toBeChecked();
  await page.getByRole('button', { name: 'Prepare feedback' }).click();
  await expect(page.getByRole('link', { name: 'Open email to send' })).toHaveAttribute('href', /^mailto:asepsisedmond@gmail.com/);
  await page.getByText('Read feedback text', { exact: true }).click();
  await expect(page.locator('.feedback-draft pre')).toContainText('No, private feedback only');
  await page.getByRole('combobox', { name: /^Service/ }).selectOption('project');
  await expect(page.locator('.feedback-draft')).toHaveCount(0);
  await consent.check();
  await page.getByRole('button', { name: 'Prepare feedback' }).click();
  await expect(page.getByRole('link', { name: 'Open email to send' })).toHaveAttribute('href', /^mailto:asepsisedmond@gmail.com/);
});

test('new pages fit desktop and mobile and do not show the former business address', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['blog', 'gallery', 'reviews', 'quote', 'pro']) {
      await page.goto('/#/' + route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('body')).not.toContainText('Jasper');
      await expect(page.locator('footer')).toContainText('Location: Oklahoma');
    }
  }
  await page.goto('/#/quote?type=project');
  await expect(page.locator('.contact-box')).toContainText('asepsisedmond@gmail.com');
  await page.getByLabel('Name', { exact: true }).fill('Test Project');
  await page.getByLabel('Phone', { exact: true }).fill('4055550123');
  await page.getByLabel('Email', { exact: true }).fill('project@example.com');
  await page.getByLabel('Property address or city').fill('Oklahoma City');
  await expect(page.getByRole('button', { name: 'Continue to review & payment' })).toBeVisible();
  await expect(page.locator('.quote-layout a[href^="mailto:"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Home cleaning', exact: true }).click();
  await expect(page.locator('.contact-box')).toContainText('asepsisedmond@gmail.com');
  expect(errors).toEqual([]);
});
