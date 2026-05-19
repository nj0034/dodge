export type Vec2 = {
  x: number;
  y: number;
};

export type BulletKind = 'basic' | 'heavy' | 'dash' | 'spiral' | 'split';

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

export type Bounds = {
  width: number;
  height: number;
};

export type Circle = Vec2 & {
  radius: number;
};

export type Player = {
  position: Vec2;
  radius: number;
  speed: number;
  shieldAvailable: boolean;
  invulnerableMs: number;
  alive: boolean;
};

export type Difficulty = {
  elapsedMs: number;
  spawnIntervalMs: number;
  baseSpeed: number;
  maxBullets: number;
  unlockedKinds: BulletKind[];
};

export type Bullet = {
  id: number;
  kind: BulletKind;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  color: string;
  ageMs: number;
  delayMs: number;
  splitAtMs?: number;
  hasSplit?: boolean;
};
