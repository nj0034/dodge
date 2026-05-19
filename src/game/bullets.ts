import { BULLET_COLORS } from './config';
import type { Rng } from './rng';
import type { Bounds, Bullet, BulletKind, Vec2 } from './types';

const SPAWN_PADDING = 28;
const CLEANUP_PADDING = 120;
const SPLIT_ANGLE_RADIANS = Math.PI / 7;

type SpawnBulletInput = {
  id: number;
  rng: Rng;
  bounds: Bounds;
  playerPosition: Vec2;
  elapsedMs: number;
  kind: BulletKind;
  speed: number;
};

type UpdateBulletsResult = {
  bullets: Bullet[];
  nextId: number;
};

const magnitude = (value: Vec2) => Math.hypot(value.x, value.y) || 1;

const normalize = (value: Vec2): Vec2 => {
  const length = magnitude(value);
  return { x: value.x / length, y: value.y / length };
};

const scale = (value: Vec2, amount: number): Vec2 => ({
  x: value.x * amount,
  y: value.y * amount,
});

const rotate = (value: Vec2, radians: number): Vec2 => {
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);

  return {
    x: value.x * cos - value.y * sin,
    y: value.x * sin + value.y * cos,
  };
};

function createEdgePosition(rng: Rng, bounds: Bounds): Vec2 {
  const edge = Math.floor(rng.next() * 4);
  const alongX = rng.next() * bounds.width;
  const alongY = rng.next() * bounds.height;

  if (edge === 0) return { x: alongX, y: -SPAWN_PADDING };
  if (edge === 1) return { x: bounds.width + SPAWN_PADDING, y: alongY };
  if (edge === 2) return { x: alongX, y: bounds.height + SPAWN_PADDING };
  return { x: -SPAWN_PADDING, y: alongY };
}

function bulletRadius(kind: BulletKind): number {
  if (kind === 'heavy') return 22;
  if (kind === 'dash') return 12;
  return 14;
}

function speedMultiplier(kind: BulletKind): number {
  if (kind === 'heavy') return 0.72;
  if (kind === 'dash') return 1.45;
  if (kind === 'spiral') return 0.9;
  return 1;
}

export function chooseBulletKind(
  unlockedKinds: BulletKind[],
  rng: Rng,
): BulletKind {
  const roll = rng.next();

  if (unlockedKinds.includes('split') && roll > 0.94) return 'split';
  if (unlockedKinds.includes('spiral') && roll > 0.8) return 'spiral';
  if (unlockedKinds.includes('dash') && roll > 0.62) return 'dash';
  if (unlockedKinds.includes('heavy') && roll > 0.42) return 'heavy';
  return 'basic';
}

export function spawnBullet(input: SpawnBulletInput): Bullet {
  const position = createEdgePosition(input.rng, input.bounds);
  const aimOffset = input.kind === 'heavy' ? 0 : 62;
  const target = {
    x: input.playerPosition.x + (input.rng.next() - 0.5) * aimOffset,
    y: input.playerPosition.y + (input.rng.next() - 0.5) * aimOffset,
  };
  const direction = normalize({
    x: target.x - position.x,
    y: target.y - position.y,
  });
  const adjustedSpeed = input.speed * speedMultiplier(input.kind);

  return {
    id: input.id,
    kind: input.kind,
    position,
    velocity: scale(direction, adjustedSpeed),
    radius: bulletRadius(input.kind),
    color: BULLET_COLORS[input.kind],
    ageMs: 0,
    delayMs: input.kind === 'dash' ? 450 : 0,
    splitAtMs: input.kind === 'split' ? 800 : undefined,
    hasSplit: false,
  };
}

function isWithinCleanupBounds(bullet: Bullet, bounds: Bounds): boolean {
  return (
    bullet.position.x >= -CLEANUP_PADDING &&
    bullet.position.x <= bounds.width + CLEANUP_PADDING &&
    bullet.position.y >= -CLEANUP_PADDING &&
    bullet.position.y <= bounds.height + CLEANUP_PADDING
  );
}

function moveBullet(bullet: Bullet, deltaMs: number): Bullet {
  const nextAgeMs = bullet.ageMs + deltaMs;

  const turn =
    bullet.kind === 'spiral'
      ? Math.sin(nextAgeMs / 180) * 0.11
      : 0;
  const velocity = turn === 0 ? bullet.velocity : rotate(bullet.velocity, turn);
  const movementMs =
    bullet.kind === 'dash'
      ? Math.max(0, nextAgeMs - bullet.delayMs) -
        Math.max(0, bullet.ageMs - bullet.delayMs)
      : deltaMs;
  const seconds = movementMs / 1000;

  return {
    ...bullet,
    ageMs: nextAgeMs,
    velocity,
    position: {
      x: bullet.position.x + velocity.x * seconds,
      y: bullet.position.y + velocity.y * seconds,
    },
  };
}

function createSplitChildren(bullet: Bullet, nextId: number): Bullet[] {
  const speed = magnitude(bullet.velocity);
  const direction = normalize(bullet.velocity);
  const leftVelocity = scale(rotate(direction, -SPLIT_ANGLE_RADIANS), speed);
  const rightVelocity = scale(rotate(direction, SPLIT_ANGLE_RADIANS), speed);

  return [leftVelocity, rightVelocity].map((velocity, index) => ({
    id: nextId + index,
    kind: 'basic',
    position: bullet.position,
    velocity,
    radius: 11,
    color: BULLET_COLORS.basic,
    ageMs: 0,
    delayMs: 0,
    hasSplit: false,
  }));
}

export function updateBullets(
  bullets: Bullet[],
  deltaMs: number,
  bounds: Bounds,
  nextId: number,
): UpdateBulletsResult {
  const nextBullets: Bullet[] = [];
  let id = nextId;

  for (const bullet of bullets) {
    const moved = moveBullet(bullet, deltaMs);
    const shouldSplit =
      moved.kind === 'split' &&
      moved.hasSplit !== true &&
      moved.splitAtMs !== undefined &&
      moved.ageMs >= moved.splitAtMs;

    const current = shouldSplit ? { ...moved, hasSplit: true } : moved;
    const shouldRetain = isWithinCleanupBounds(current, bounds);

    if (shouldRetain) {
      nextBullets.push(current);
    }

    if (shouldSplit && shouldRetain) {
      nextBullets.push(...createSplitChildren(current, id));
      id += 2;
    }
  }

  return { bullets: nextBullets, nextId: id };
}
