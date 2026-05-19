import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/game/rng';
import {
  chooseBulletKind,
  spawnBullet,
  updateBullets,
} from '../../src/game/bullets';
import { createGameState, updateGameState } from '../../src/game/state';
import type { Bullet, BulletKind } from '../../src/game/types';

const fakeRng = (value: number) => ({
  next: () => value,
});

describe('bullets', () => {
  it('spawns bullets from outside an edge toward the player', () => {
    const playerPosition = { x: 480, y: 320 };
    const bullet = spawnBullet({
      id: 1,
      rng: createRng(1),
      bounds: { width: 960, height: 640 },
      playerPosition,
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

    const vectorToPlayer = {
      x: playerPosition.x - bullet.position.x,
      y: playerPosition.y - bullet.position.y,
    };
    const dotProduct =
      vectorToPlayer.x * bullet.velocity.x +
      vectorToPlayer.y * bullet.velocity.y;

    expect(dotProduct).toBeGreaterThan(0);
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
    const originalPosition = bullet.position;

    const updated = updateBullets([bullet], 100, { width: 960, height: 640 }, 2);
    const movedBullet = updated.bullets[0];

    expect(movedBullet?.ageMs).toBe(100);
    expect(
      movedBullet === undefined
        ? 0
        : Math.hypot(
            movedBullet.position.x - originalPosition.x,
            movedBullet.position.y - originalPosition.y,
          ),
    ).toBeGreaterThan(0);
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

    expect(updated.bullets).toHaveLength(3);
    expect(updated.nextId).toBe(4);

    const updatedAgain = updateBullets(
      updated.bullets,
      900,
      { width: 960, height: 640 },
      updated.nextId,
    );

    expect(updatedAgain.bullets).toHaveLength(3);
    expect(updatedAgain.nextId).toBe(4);
  });
});

describe('chooseBulletKind', () => {
  const allKinds: BulletKind[] = [
    'basic',
    'heavy',
    'dash',
    'spiral',
    'split',
  ];

  it('selects rare split bullets only on the highest rolls', () => {
    expect(chooseBulletKind(allKinds, fakeRng(0.95))).toBe('split');
  });

  it('keeps near-high rolls below the split threshold on spiral', () => {
    expect(chooseBulletKind(allKinds, fakeRng(0.93))).toBe('spiral');
  });

  it('selects from early unlocked kinds using weighted thresholds', () => {
    expect(chooseBulletKind(['basic', 'heavy'], fakeRng(0.9))).toBe('heavy');
    expect(chooseBulletKind(['basic', 'heavy'], fakeRng(0.1))).toBe('basic');
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
