import { describe, expect, it } from 'vitest';
import {
  createPlayer,
  movePlayer,
  registerPlayerHit,
} from '../../src/game/player';

describe('player', () => {
  it('moves with arrow input and stays inside bounds', () => {
    const player = createPlayer(100, 100);
    const moved = movePlayer(
      player,
      { left: false, right: true, up: true, down: false },
      1000,
      { width: 100, height: 100 },
    );

    expect(moved.position.x).toBeLessThanOrEqual(88);
    expect(moved.position.y).toBeGreaterThanOrEqual(12);
  });

  it('consumes shield on first hit and dies on second hit', () => {
    const shielded = registerPlayerHit(createPlayer(100, 100));

    expect(shielded.shieldAvailable).toBe(false);
    expect(shielded.alive).toBe(true);

    const dead = registerPlayerHit(shielded);

    expect(dead.shieldAvailable).toBe(false);
    expect(dead.alive).toBe(false);
  });

  it('can respect invulnerability after shield is consumed', () => {
    const shielded = registerPlayerHit(createPlayer(100, 100));
    const stillShielded = registerPlayerHit(shielded, {
      respectInvulnerability: true,
    });

    expect(stillShielded.alive).toBe(true);
    expect(stillShielded.shieldAvailable).toBe(false);
  });
});
