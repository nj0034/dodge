import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/game/rng';
import { spawnBullet, updateBullets } from '../../src/game/bullets';
import { createGameState, updateGameState } from '../../src/game/state';
import type { Bullet } from '../../src/game/types';

describe('bullets', () => {
  it('spawns bullets from outside an edge toward the player', () => {
    const bullet = spawnBullet({
      id: 1,
      rng: createRng(1),
      bounds: { width: 960, height: 640 },
      playerPosition: { x: 480, y: 320 },
      elapsedMs: 0,
      kind: 'basic',
      speed: 120,
    });

    const outside =
      bullet.position.x < 0 ||
      bullet.position.x > 960 ||
      bullet.position.y < 0 ||
      bullet.position.y > 640;

    expect(outside).toBe(true);
    expect(Math.hypot(bullet.velocity.x, bullet.velocity.y)).toBeCloseTo(
      120,
      3,
    );
  });

  it('moves active bullets and removes old off-screen bullets', () => {
    const bullet = spawnBullet({
      id: 1,
      rng: createRng(2),
      bounds: { width: 960, height: 640 },
      playerPosition: { x: 480, y: 320 },
      elapsedMs: 0,
      kind: 'basic',
      speed: 120,
    });

    const updated = updateBullets([bullet], 100, { width: 960, height: 640 }, 2);

    expect(updated.bullets[0]?.ageMs).toBe(100);
    expect(updated.nextId).toBe(2);
  });

  it('split bullets create two child bullets once', () => {
    const bullet = spawnBullet({
      id: 1,
      rng: createRng(3),
      bounds: { width: 960, height: 640 },
      playerPosition: { x: 480, y: 320 },
      elapsedMs: 90_000,
      kind: 'split',
      speed: 160,
    });

    const updated = updateBullets([bullet], 900, { width: 960, height: 640 }, 2);

    expect(updated.bullets.length).toBeGreaterThan(1);
    expect(updated.nextId).toBeGreaterThan(2);
  });
});

describe('game state collisions', () => {
  it('keeps a shielded player alive during collision invulnerability', () => {
    const state = createGameState(1);
    const overlappingBullet: Bullet = {
      id: 1,
      kind: 'basic',
      position: state.player.position,
      velocity: { x: 0, y: 0 },
      radius: state.player.radius,
      color: '#ffffff',
      ageMs: 0,
      delayMs: 0,
    };

    const firstHit = updateGameState(
      { ...state, status: 'playing', bullets: [overlappingBullet] },
      { left: false, right: false, up: false, down: false },
      16,
    );

    expect(firstHit.player.shieldAvailable).toBe(false);
    expect(firstHit.status).toBe('playing');

    const secondHit = updateGameState(
      firstHit,
      { left: false, right: false, up: false, down: false },
      16,
    );

    expect(secondHit.status).toBe('playing');
    expect(secondHit.player.alive).toBe(true);
  });
});
