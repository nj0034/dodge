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

  it('keeps controls responsive at the expanded playfield scale', () => {
    const player = createPlayer(2400, 1600);

    expect(player.radius).toBe(12);
    expect(player.speed).toBe(760);
  });

  it('consumes shield on first hit and dies on second hit', () => {
    const shielded = registerPlayerHit(createPlayer(100, 100));

    expect(shielded.shieldAvailable).toBe(false);
    expect(shielded.alive).toBe(true);

    const dead = registerPlayerHit(shielded, { ignoreInvulnerability: true });

    expect(dead.shieldAvailable).toBe(false);
    expect(dead.alive).toBe(false);
  });

  it('respects invulnerability after shield is consumed by default', () => {
    const shielded = registerPlayerHit(createPlayer(100, 100));
    const stillShielded = registerPlayerHit(shielded);

    expect(stillShielded.alive).toBe(true);
    expect(stillShielded.shieldAvailable).toBe(false);
  });
});
