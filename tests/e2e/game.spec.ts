import { expect, test } from '@playwright/test';

test('starts the game and moves with arrow keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '닷지' })).toBeVisible();

  await page.getByTestId('start-game').click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');

  const canvas = page.locator('#game');
  await expect(canvas).toBeVisible();
  await expect(page.getByText('GAME OVER')).toHaveCount(0);
});

test('shows the start button with an empty leaderboard response', async ({ page }) => {
  await page.route('**/api/scores', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: { scores: [] },
    });
  });

  await page.goto('/');

  await expect(page.getByTestId('start-game')).toBeVisible();
  await expect(page.getByText('No online scores yet.')).toBeVisible();
});
