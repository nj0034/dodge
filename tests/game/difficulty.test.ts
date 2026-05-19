import { describe, expect, it } from 'vitest';
import { getDifficulty } from '../../src/game/difficulty';

describe('getDifficulty', () => {
  it('starts with only basic bullets', () => {
    expect(getDifficulty(0).unlockedKinds).toEqual(['basic']);
  });

  it('clamps negative elapsed time to zero', () => {
    expect(getDifficulty(-1000).elapsedMs).toBe(0);
  });

  it('unlocks patterns at the designed thresholds', () => {
    expect(getDifficulty(20_000).unlockedKinds).toContain('heavy');
    expect(getDifficulty(40_000).unlockedKinds).toContain('dash');
    expect(getDifficulty(60_000).unlockedKinds).toContain('spiral');
    expect(getDifficulty(90_000).unlockedKinds).toContain('split');
  });

  it('caps spawn pressure to readable limits', () => {
    const late = getDifficulty(10 * 60_000);

    expect(late.spawnIntervalMs).toBeGreaterThanOrEqual(150);
    expect(late.maxBullets).toBeLessThanOrEqual(260);
    expect(late.baseSpeed).toBeLessThanOrEqual(360);
  });
});
