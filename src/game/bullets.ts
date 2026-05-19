import { BULLET_COLORS } from './config';
import type { Rng } from './rng';
import type { Bounds, Bullet, BulletKind, Vec2 } from './types';

const SPAWN_PADDING = 36;
const CLEANUP_PADDING = 180;
const SPLIT_ANGLE_RADIANS = Math.PI / 7;
const SPIRAL_WAVE_PERIOD_MS = 760;
const SPIRAL_FORWARD_RATIO = 0.96;
const SPIRAL_LATERAL_RATIO = 0.62;

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

const add = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
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
  if (kind === 'heavy') return 16;
  if (kind === 'dash') return 8;
  return 10;
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
  const aimOffset = input.kind === 'heavy' ? 0 : 90;
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
  const movementMs =
    bullet.kind === 'dash'
      ? Math.max(0, nextAgeMs - bullet.delayMs) -
        Math.max(0, bullet.ageMs - bullet.delayMs)
      : deltaMs;
  const seconds = movementMs / 1000;
  const baseVelocity = bullet.velocity;
  const velocity =
    bullet.kind === 'spiral'
      ? createSpiralMovementVelocity(baseVelocity, nextAgeMs)
      : baseVelocity;

  return {
    ...bullet,
    ageMs: nextAgeMs,
    velocity: baseVelocity,
    position: {
      x: bullet.position.x + velocity.x * seconds,
      y: bullet.position.y + velocity.y * seconds,
    },
  };
}

function createSpiralMovementVelocity(baseVelocity: Vec2, ageMs: number): Vec2 {
  const speed = magnitude(baseVelocity);
  const forward = normalize(baseVelocity);
  const lateral = { x: -forward.y, y: forward.x };
  const wave = Math.sin((ageMs / SPIRAL_WAVE_PERIOD_MS) * Math.PI * 2);

  return add(
    scale(forward, speed * SPIRAL_FORWARD_RATIO),
    scale(lateral, speed * SPIRAL_LATERAL_RATIO * wave),
  );
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
    radius: 8,
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
