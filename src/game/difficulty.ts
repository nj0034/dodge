import {
  MAX_BULLET_SPEED,
  MAX_BULLETS,
  MIN_SPAWN_INTERVAL_MS,
} from './config';
import type { BulletKind, Difficulty } from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function getDifficulty(elapsedMs: number): Difficulty {
  const clampedElapsedMs = Math.max(0, elapsedMs);
  const seconds = clampedElapsedMs / 1000;
  const unlockedKinds: BulletKind[] = ['basic'];

  if (seconds >= 20) unlockedKinds.push('heavy');
  if (seconds >= 40) unlockedKinds.push('dash');
  if (seconds >= 60) unlockedKinds.push('spiral');
  if (seconds >= 90) unlockedKinds.push('split');

  return {
    elapsedMs: clampedElapsedMs,
    spawnIntervalMs: clamp(900 - seconds * 12, MIN_SPAWN_INTERVAL_MS, 900),
    baseSpeed: clamp(120 + seconds * 3.2, 120, MAX_BULLET_SPEED),
    maxBullets: Math.floor(clamp(32 + seconds * 2.4, 32, MAX_BULLETS)),
    unlockedKinds,
  };
}
