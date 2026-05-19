import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

type CanvasSample = {
  center: number;
  right: number;
};

type ImmediateDirectionResponse = {
  before: CanvasSample;
  after: CanvasSample;
};

const samplePlayerRegions = async (canvas: Locator) =>
  canvas.evaluate((element) => {
    const canvasElement = element as HTMLCanvasElement;
    const context = canvasElement.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }

    const sampleChecksum = (x: number, y: number) => {
      const size = 36;
      const left = Math.round(x - size / 2);
      const top = Math.round(y - size / 2);
      const data = context.getImageData(left, top, size, size).data;
      let checksum = 0;

      for (let index = 0; index < data.length; index += 4) {
        checksum += data[index] + data[index + 1] * 3 + data[index + 2] * 5 + data[index + 3] * 7;
      }

      return checksum;
    };

    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    const rightShiftX = centerX + canvasElement.width * (120 / 2400);

    return {
      center: sampleChecksum(centerX, centerY),
      right: sampleChecksum(rightShiftX, centerY),
    } satisfies CanvasSample;
  });

const sampleImmediateDirectionResponse = async (
  page: Page,
  canvas: Locator,
) => {
  const before = await samplePlayerRegions(canvas);

  await page.keyboard.down('ArrowRight');
  const after = await samplePlayerRegions(canvas);
  await page.keyboard.up('ArrowRight');

  return { before, after } satisfies ImmediateDirectionResponse;
};

const setStoredNickname = async (page: Page, nickname = 'pilot') => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('dodge.nickname', value);
  }, nickname);
};

test('starts the game and moves with arrow keys', async ({ page }) => {
  await setStoredNickname(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '닷지' })).toBeVisible();

  const canvas = page.locator('#game');

  await page.getByTestId('start-game').click();
  await expect(canvas).toBeVisible();

  const beforeMove = await samplePlayerRegions(canvas);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');

  const afterMove = await samplePlayerRegions(canvas);

  expect(Math.abs(afterMove.center - beforeMove.center)).toBeGreaterThan(10_000);
  expect(Math.abs(afterMove.right - beforeMove.right)).toBeGreaterThan(10_000);
  await expect(page.getByText('GAME OVER')).toHaveCount(0);
});

test('moves on arrow keydown before the next animation frame', async ({ page }) => {
  await setStoredNickname(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '닷지' })).toBeVisible();

  const canvas = page.locator('#game');

  await page.getByTestId('start-game').click();
  await expect(canvas).toBeVisible();

  const response = await sampleImmediateDirectionResponse(page, canvas);

  const centerDelta = Math.abs(response.after.center - response.before.center);
  const rightDelta = Math.abs(response.after.right - response.before.right);

  expect(centerDelta + rightDelta).toBeGreaterThan(2_000);
  await expect(page.getByText('GAME OVER')).toHaveCount(0);
});

test('space starts, pauses, and resumes the game', async ({ page }) => {
  await setStoredNickname(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '닷지' })).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: '닷지' })).toHaveCount(0);

  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toBeVisible();

  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'PAUSED' })).toHaveCount(0);
  await expect(page.getByText('GAME OVER')).toHaveCount(0);
});

test('prefills and updates the home nickname from local storage', async ({ page }) => {
  await setStoredNickname(page, 'Ace');
  await page.goto('/');

  await expect(page.getByLabel('Nickname')).toHaveValue('Ace');

  await page.getByLabel('Nickname').fill('Nova');
  await page.getByTestId('start-game').click();

  await expect(page.getByRole('heading', { name: '닷지' })).toHaveCount(0);
  await expect(
    page.evaluate(() => window.localStorage.getItem('dodge.nickname')),
  ).resolves.toBe('Nova');
});

test('submits the stored nickname automatically after game over', async ({ page }) => {
  await setStoredNickname(page, 'AutoPilot');

  const submissions: unknown[] = [];

  await page.route('**/api/scores', async (route) => {
    if (route.request().method() === 'POST') {
      submissions.push(route.request().postDataJSON());
    }

    await route.fulfill({
      contentType: 'application/json',
      json: {
        scores: [
          {
            nickname: 'AutoPilot',
            survivalMs: 1000,
            createdAt: '2026-05-19T00:00:00.000Z',
          },
        ],
      },
    });
  });

  await page.goto('/');
  await page.getByTestId('start-game').click();

  await expect(page.getByText('GAME OVER')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Nickname form')).toHaveCount(0);
  await expect.poll(() => submissions.length).toBeGreaterThan(0);
  expect(submissions[0]).toMatchObject({
    nickname: 'AutoPilot',
  });
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
