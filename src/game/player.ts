import {
  PLAYER_HIT_INVULNERABLE_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from './config';
import type { Bounds, InputState, Player, Vec2 } from './types';

type RegisterPlayerHitOptions = {
  respectInvulnerability?: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function createPlayer(width: number, height: number): Player {
  return {
    position: { x: width / 2, y: height / 2 },
    radius: PLAYER_RADIUS,
    speed: PLAYER_SPEED,
    shieldAvailable: true,
    invulnerableMs: 0,
    alive: true,
  };
}

export function movePlayer(
  player: Player,
  input: InputState,
  deltaMs: number,
  bounds: Bounds,
): Player {
  const direction: Vec2 = {
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  };
  const length = Math.hypot(direction.x, direction.y) || 1;
  const distance = player.speed * (deltaMs / 1000);

  return {
    ...player,
    invulnerableMs: Math.max(0, player.invulnerableMs - deltaMs),
    position: {
      x: clamp(
        player.position.x + (direction.x / length) * distance,
        player.radius,
        bounds.width - player.radius,
      ),
      y: clamp(
        player.position.y + (direction.y / length) * distance,
        player.radius,
        bounds.height - player.radius,
      ),
    },
  };
}

export function registerPlayerHit(
  player: Player,
  options?: RegisterPlayerHitOptions,
): Player {
  if (!player.alive) {
    return player;
  }

  if (options?.respectInvulnerability === true && player.invulnerableMs > 0) {
    return player;
  }

  if (player.shieldAvailable) {
    return {
      ...player,
      shieldAvailable: false,
      invulnerableMs: PLAYER_HIT_INVULNERABLE_MS,
    };
  }

  return {
    ...player,
    alive: false,
  };
}
