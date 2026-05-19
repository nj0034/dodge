# Dodge Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a browser-based space dodge game with arrow-key controls, escalating bullet patterns, local best score, and a Cloudflare D1-backed online leaderboard.

**Architecture:** Use Vite + TypeScript + Canvas for the playable game. Keep game logic in small pure modules that can be unit-tested without a browser, then use DOM overlays only for menu, game-over, and leaderboard UI. Use Cloudflare Pages Functions with a D1 binding named `DB` for the leaderboard.

**Tech Stack:** Vite, TypeScript, Canvas 2D, Vitest, Playwright, Cloudflare Pages Functions, Cloudflare D1, Wrangler, GitHub CLI.

---

## File Structure

- Create `.gitignore`: ignores dependencies, build output, local Cloudflare state, and `.superpowers/`.
- Create `package.json`: scripts for dev, test, build, preview, Pages dev, and Playwright verification.
- Create `index.html`: Vite entry HTML with root overlay and canvas shell.
- Create `tsconfig.json`: strict browser TypeScript config excluding `functions`.
- Create `vite.config.ts`: Vite config with Vitest settings.
- Create `wrangler.toml`: Cloudflare Pages config with `pages_build_output_dir = "./dist"`; D1 is bound from the Cloudflare dashboard during setup.
- Create `migrations/0001_create_scores.sql`: D1 `scores` table and index.
- Create `docs/deployment/cloudflare-pages.md`: manual Cloudflare Pages + D1 setup guide.
- Create `src/main.ts`: bootstraps the game.
- Create `src/styles.css`: responsive game layout, overlays, buttons, leaderboard table.
- Create `src/game/types.ts`: shared game types.
- Create `src/game/config.ts`: constants for world size, colors, player, bullets, and limits.
- Create `src/game/rng.ts`: deterministic RNG used by tests and game spawning.
- Create `src/game/input.ts`: arrow-key state tracker.
- Create `src/game/difficulty.ts`: elapsed-time difficulty curve and pattern unlocks.
- Create `src/game/player.ts`: player movement, bounds, shield hit handling.
- Create `src/game/bullets.ts`: bullet spawning, movement, split behavior, and cleanup.
- Create `src/game/collision.ts`: circle collision helpers.
- Create `src/game/state.ts`: game state creation and update loop.
- Create `src/game/renderer.ts`: Canvas drawing for dim stars, readable bullets, ship, shield, HUD.
- Create `src/shared/scores.ts`: nickname and score validation shared by frontend and Pages Functions.
- Create `src/leaderboard/client.ts`: browser API client with graceful failure behavior.
- Create `src/ui/app.ts`: DOM overlay state, start/restart, score submit, leaderboard render.
- Create `functions/api/scores.ts`: `GET` and `POST` Pages Functions for D1 scores.
- Create `tests/game/difficulty.test.ts`: difficulty threshold tests.
- Create `tests/game/player.test.ts`: player bounds and shield/game-over tests.
- Create `tests/game/bullets.test.ts`: bullet spawn/update tests.
- Create `tests/game/collision.test.ts`: collision tests.
- Create `tests/shared/scores.test.ts`: score validation tests.
- Create `tests/functions/scores.test.ts`: Pages Function handler tests with a fake D1 binding.
- Create `tests/e2e/game.spec.ts`: browser smoke tests for start, movement, and game-over UI.

## Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Create package metadata and scripts**

Create `package.json` with:

```json
{
  "name": "dodge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "cf:dev": "npm run build && wrangler pages dev dist"
  },
  "dependencies": {},
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.1.4",
    "wrangler": "^4.15.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code `0`.

- [ ] **Step 3: Add repository ignores**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars
.superpowers/
playwright-report/
test-results/
coverage/
.DS_Store
```

- [ ] **Step 4: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "tests", "vite.config.ts"],
  "exclude": ["functions", "dist", "node_modules"]
}
```

- [ ] **Step 5: Add Vite and Vitest config**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Add base HTML**

Create `index.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Arrow-key space dodge game" />
    <title>Dodge</title>
  </head>
  <body>
    <main id="app">
      <canvas id="game" width="960" height="640" aria-label="Dodge game canvas"></canvas>
      <section id="overlay" aria-live="polite"></section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Add temporary bootstrap and base styles**

Create `src/main.ts`:

```ts
import './styles.css';

const overlay = document.querySelector<HTMLDivElement>('#overlay');

if (!overlay) {
  throw new Error('Missing #overlay element');
}

overlay.innerHTML = `
  <div class="panel">
    <p class="eyebrow">DODGE</p>
    <h1>닷지</h1>
    <p>방향키로 우주선을 조종해서 사방에서 몰려오는 총알을 피하세요.</p>
    <button type="button" class="primary">Start</button>
  </div>
`;
```

Create `src/styles.css`:

```css
:root {
  color: #f8fafc;
  background: #020617;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  display: grid;
  place-items: center;
  background: #020617;
}

#app {
  position: relative;
  width: min(100vw, 1200px);
  height: min(100vh, 800px);
  min-width: 720px;
  min-height: 520px;
  background: #020617;
}

#game {
  display: block;
  width: 100%;
  height: 100%;
  background: #020617;
}

#overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.panel {
  width: min(420px, calc(100% - 48px));
  padding: 24px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.88);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  pointer-events: auto;
}

.eyebrow {
  margin: 0 0 8px;
  color: #38bdf8;
  font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0;
}

h1 {
  margin: 0 0 12px;
  font-size: 40px;
  line-height: 1;
}

p {
  color: #cbd5e1;
  line-height: 1.6;
}

button,
input {
  font: inherit;
}

.primary {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  color: #020617;
  background: #38bdf8;
  font-weight: 800;
  cursor: pointer;
}
```

- [ ] **Step 8: Verify scaffold**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully and create `dist/`.

- [ ] **Step 9: Commit scaffold**

Run:

```bash
git add .gitignore package.json package-lock.json index.html tsconfig.json vite.config.ts src/main.ts src/styles.css
git commit -m "chore: scaffold vite canvas game"
```

Expected: commit succeeds.

## Task 2: Core Game Types, Difficulty, Collision, Player

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/config.ts`
- Create: `src/game/difficulty.ts`
- Create: `src/game/collision.ts`
- Create: `src/game/player.ts`
- Test: `tests/game/difficulty.test.ts`
- Test: `tests/game/collision.test.ts`
- Test: `tests/game/player.test.ts`

- [ ] **Step 1: Write difficulty tests**

Create `tests/game/difficulty.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getDifficulty } from '../../src/game/difficulty';

describe('getDifficulty', () => {
  it('starts with only basic bullets', () => {
    expect(getDifficulty(0).unlockedKinds).toEqual(['basic']);
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
```

- [ ] **Step 2: Write collision tests**

Create `tests/game/collision.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { circlesOverlap } from '../../src/game/collision';

describe('circlesOverlap', () => {
  it('returns true when two circles touch or overlap', () => {
    expect(
      circlesOverlap(
        { x: 0, y: 0, radius: 10 },
        { x: 18, y: 0, radius: 8 },
      ),
    ).toBe(true);
  });

  it('returns false when circles are separated', () => {
    expect(
      circlesOverlap(
        { x: 0, y: 0, radius: 10 },
        { x: 30, y: 0, radius: 8 },
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Write player tests**

Create `tests/game/player.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer, movePlayer, registerPlayerHit } from '../../src/game/player';

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
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
npm test -- tests/game/difficulty.test.ts tests/game/collision.test.ts tests/game/player.test.ts
```

Expected: FAIL because the game modules do not exist yet.

- [ ] **Step 5: Implement shared game types and config**

Create `src/game/types.ts`:

```ts
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
```

Create `src/game/config.ts`:

```ts
export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 640;

export const PLAYER_RADIUS = 12;
export const PLAYER_SPEED = 320;
export const PLAYER_HIT_INVULNERABLE_MS = 900;

export const MAX_BULLETS = 260;
export const MAX_BULLET_SPEED = 360;
export const MIN_SPAWN_INTERVAL_MS = 150;

export const BULLET_COLORS = {
  basic: '#fb923c',
  heavy: '#facc15',
  dash: '#fb7185',
  spiral: '#38bdf8',
  split: '#f43f5e',
} as const;
```

- [ ] **Step 6: Implement difficulty, collision, and player**

Create `src/game/difficulty.ts`:

```ts
import {
  MAX_BULLET_SPEED,
  MAX_BULLETS,
  MIN_SPAWN_INTERVAL_MS,
} from './config';
import type { BulletKind, Difficulty } from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function getDifficulty(elapsedMs: number): Difficulty {
  const seconds = Math.max(0, elapsedMs / 1000);
  const unlockedKinds: BulletKind[] = ['basic'];

  if (seconds >= 20) unlockedKinds.push('heavy');
  if (seconds >= 40) unlockedKinds.push('dash');
  if (seconds >= 60) unlockedKinds.push('spiral');
  if (seconds >= 90) unlockedKinds.push('split');

  return {
    elapsedMs,
    spawnIntervalMs: clamp(900 - seconds * 12, MIN_SPAWN_INTERVAL_MS, 900),
    baseSpeed: clamp(120 + seconds * 3.2, 120, MAX_BULLET_SPEED),
    maxBullets: Math.floor(clamp(32 + seconds * 2.4, 32, MAX_BULLETS)),
    unlockedKinds,
  };
}
```

Create `src/game/collision.ts`:

```ts
import type { Circle } from './types';

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;

  return dx * dx + dy * dy <= radius * radius;
}
```

Create `src/game/player.ts`:

```ts
import {
  PLAYER_HIT_INVULNERABLE_MS,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from './config';
import type { Bounds, InputState, Player, Vec2 } from './types';

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

export function registerPlayerHit(player: Player): Player {
  if (player.invulnerableMs > 0 || !player.alive) {
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
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- tests/game/difficulty.test.ts tests/game/collision.test.ts tests/game/player.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit core logic**

Run:

```bash
git add src/game tests/game
git commit -m "feat: add core game logic"
```

Expected: commit succeeds.

## Task 3: Bullet Spawning And Game State

**Files:**
- Create: `src/game/rng.ts`
- Create: `src/game/bullets.ts`
- Create: `src/game/state.ts`
- Test: `tests/game/bullets.test.ts`

- [ ] **Step 1: Write bullet tests**

Create `tests/game/bullets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/game/rng';
import { spawnBullet, updateBullets } from '../../src/game/bullets';

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
    expect(Math.hypot(bullet.velocity.x, bullet.velocity.y)).toBeCloseTo(120, 3);
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
```

- [ ] **Step 2: Run bullet tests to verify failure**

Run:

```bash
npm test -- tests/game/bullets.test.ts
```

Expected: FAIL because `rng` and `bullets` modules do not exist.

- [ ] **Step 3: Implement deterministic RNG**

Create `src/game/rng.ts`:

```ts
export type Rng = {
  next(): number;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return {
    next() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}
```

- [ ] **Step 4: Implement bullet spawning and updates**

Create `src/game/bullets.ts`:

```ts
import { BULLET_COLORS } from './config';
import type { Rng } from './rng';
import type { Bounds, Bullet, BulletKind, Vec2 } from './types';

type SpawnBulletInput = {
  id: number;
  rng: Rng;
  bounds: Bounds;
  playerPosition: Vec2;
  elapsedMs: number;
  kind: BulletKind;
  speed: number;
};

const EDGE_PADDING = 28;
const CLEANUP_PADDING = 96;

const radiusByKind: Record<BulletKind, number> = {
  basic: 4,
  heavy: 9,
  dash: 5,
  spiral: 4,
  split: 6,
};

function normalize(vector: Vec2): Vec2 {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function rotate(vector: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function edgePosition(rng: Rng, bounds: Bounds): Vec2 {
  const edge = Math.floor(rng.next() * 4);
  const x = rng.next() * bounds.width;
  const y = rng.next() * bounds.height;

  if (edge === 0) return { x, y: -EDGE_PADDING };
  if (edge === 1) return { x: bounds.width + EDGE_PADDING, y };
  if (edge === 2) return { x, y: bounds.height + EDGE_PADDING };
  return { x: -EDGE_PADDING, y };
}

export function spawnBullet(input: SpawnBulletInput): Bullet {
  const position = edgePosition(input.rng, input.bounds);
  let direction = normalize({
    x: input.playerPosition.x - position.x,
    y: input.playerPosition.y - position.y,
  });
  let speed = input.speed;
  let delayMs = 0;

  if (input.kind === 'heavy') {
    speed *= 0.68;
  }

  if (input.kind === 'dash') {
    speed *= 2.1;
    delayMs = 650;
  }

  if (input.kind === 'spiral') {
    const twist = Math.sin(input.elapsedMs / 700) * 0.75;
    direction = rotate(direction, twist);
    speed *= 0.9;
  }

  if (input.kind === 'split') {
    speed *= 0.82;
  }

  return {
    id: input.id,
    kind: input.kind,
    position,
    velocity: {
      x: direction.x * speed,
      y: direction.y * speed,
    },
    radius: radiusByKind[input.kind],
    color: BULLET_COLORS[input.kind],
    ageMs: 0,
    delayMs,
    splitAtMs: input.kind === 'split' ? 800 : undefined,
    hasSplit: false,
  };
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

export function updateBullets(
  bullets: Bullet[],
  deltaMs: number,
  bounds: Bounds,
  nextId: number,
): { bullets: Bullet[]; nextId: number } {
  const next: Bullet[] = [];
  let id = nextId;

  for (const bullet of bullets) {
    const ageMs = bullet.ageMs + deltaMs;
    const activeDelta = Math.max(0, ageMs - bullet.delayMs) - Math.max(0, bullet.ageMs - bullet.delayMs);
    const moved: Bullet = {
      ...bullet,
      ageMs,
      position: {
        x: bullet.position.x + bullet.velocity.x * (activeDelta / 1000),
        y: bullet.position.y + bullet.velocity.y * (activeDelta / 1000),
      },
    };

    if (
      moved.kind === 'split' &&
      moved.splitAtMs !== undefined &&
      moved.ageMs >= moved.splitAtMs &&
      !moved.hasSplit
    ) {
      const baseDirection = normalize(moved.velocity);
      for (const angle of [-0.65, 0.65]) {
        const direction = rotate(baseDirection, angle);
        next.push({
          ...moved,
          id: id++,
          kind: 'basic',
          radius: radiusByKind.basic,
          color: BULLET_COLORS.basic,
          velocity: {
            x: direction.x * Math.hypot(moved.velocity.x, moved.velocity.y) * 1.08,
            y: direction.y * Math.hypot(moved.velocity.x, moved.velocity.y) * 1.08,
          },
          ageMs: 0,
          delayMs: 0,
          splitAtMs: undefined,
          hasSplit: true,
        });
      }
      next.push({ ...moved, hasSplit: true });
    } else {
      next.push(moved);
    }
  }

  return {
    bullets: next.filter(
      (bullet) =>
        bullet.position.x > -CLEANUP_PADDING &&
        bullet.position.x < bounds.width + CLEANUP_PADDING &&
        bullet.position.y > -CLEANUP_PADDING &&
        bullet.position.y < bounds.height + CLEANUP_PADDING,
    ),
    nextId: id,
  };
}
```

- [ ] **Step 5: Implement game state update**

Create `src/game/state.ts`:

```ts
import { WORLD_HEIGHT, WORLD_WIDTH } from './config';
import { chooseBulletKind, spawnBullet, updateBullets } from './bullets';
import { circlesOverlap } from './collision';
import { getDifficulty } from './difficulty';
import { createPlayer, movePlayer, registerPlayerHit } from './player';
import { createRng, type Rng } from './rng';
import type { Bullet, InputState, Player } from './types';

export type GameStatus = 'ready' | 'playing' | 'gameOver';

export type GameState = {
  status: GameStatus;
  elapsedMs: number;
  player: Player;
  bullets: Bullet[];
  nextBulletId: number;
  spawnTimerMs: number;
  rng: Rng;
};

export function createGameState(seed = Date.now()): GameState {
  return {
    status: 'ready',
    elapsedMs: 0,
    player: createPlayer(WORLD_WIDTH, WORLD_HEIGHT),
    bullets: [],
    nextBulletId: 1,
    spawnTimerMs: 0,
    rng: createRng(seed),
  };
}

export function startGame(state: GameState): GameState {
  return {
    ...createGameState(Math.floor(state.rng.next() * Number.MAX_SAFE_INTEGER)),
    status: 'playing',
  };
}

export function updateGameState(
  state: GameState,
  input: InputState,
  deltaMs: number,
): GameState {
  if (state.status !== 'playing') return state;

  const clampedDelta = Math.min(deltaMs, 50);
  const elapsedMs = state.elapsedMs + clampedDelta;
  const difficulty = getDifficulty(elapsedMs);
  const player = movePlayer(state.player, input, clampedDelta, {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  });

  const updated = updateBullets(
    state.bullets,
    clampedDelta,
    { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    state.nextBulletId,
  );
  const bullets = [...updated.bullets];
  let nextBulletId = updated.nextId;
  let spawnTimerMs = state.spawnTimerMs + clampedDelta;

  while (
    spawnTimerMs >= difficulty.spawnIntervalMs &&
    bullets.length < difficulty.maxBullets
  ) {
    const kind = chooseBulletKind(difficulty.unlockedKinds, state.rng);
    bullets.push(
      spawnBullet({
        id: nextBulletId++,
        rng: state.rng,
        bounds: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
        playerPosition: player.position,
        elapsedMs,
        kind,
        speed: difficulty.baseSpeed,
      }),
    );
    spawnTimerMs -= difficulty.spawnIntervalMs;
  }

  let nextPlayer = player;
  for (const bullet of bullets) {
    if (bullet.ageMs < bullet.delayMs) continue;
    if (
      circlesOverlap(
        { ...nextPlayer.position, radius: nextPlayer.radius },
        { ...bullet.position, radius: bullet.radius },
      )
    ) {
      nextPlayer = registerPlayerHit(nextPlayer);
      break;
    }
  }

  return {
    ...state,
    status: nextPlayer.alive ? 'playing' : 'gameOver',
    elapsedMs,
    player: nextPlayer,
    bullets,
    nextBulletId,
    spawnTimerMs,
  };
}
```

- [ ] **Step 6: Run bullet and existing game tests**

Run:

```bash
npm test -- tests/game
```

Expected: PASS.

- [ ] **Step 7: Commit bullet and state logic**

Run:

```bash
git add src/game tests/game
git commit -m "feat: add bullet patterns and game state"
```

Expected: commit succeeds.

## Task 4: Canvas Renderer, Input, And UI Overlay

**Files:**
- Create: `src/game/input.ts`
- Create: `src/game/renderer.ts`
- Create: `src/ui/app.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement keyboard input**

Create `src/game/input.ts`:

```ts
import type { InputState } from './types';

const keyMap: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

export function createInputController(target: Window = window) {
  const state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  const setKey = (event: KeyboardEvent, pressed: boolean) => {
    const key = keyMap[event.key];
    if (!key) return;

    event.preventDefault();
    state[key] = pressed;
  };

  target.addEventListener('keydown', (event) => setKey(event, true));
  target.addEventListener('keyup', (event) => setKey(event, false));

  return {
    current: state,
    reset() {
      state.left = false;
      state.right = false;
      state.up = false;
      state.down = false;
    },
  };
}
```

- [ ] **Step 2: Implement renderer**

Create `src/game/renderer.ts`:

```ts
import { WORLD_HEIGHT, WORLD_WIDTH } from './config';
import { getDifficulty } from './difficulty';
import type { Bullet, Player } from './types';

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
};

export type Renderer = {
  resize(): void;
  render(input: {
    elapsedMs: number;
    player: Player;
    bullets: Bullet[];
    status: string;
  }): void;
};

function createStars(): Star[] {
  return Array.from({ length: 120 }, (_, index) => {
    const x = (index * 157) % WORLD_WIDTH;
    const y = (index * 89) % WORLD_HEIGHT;
    return {
      x,
      y,
      radius: index % 5 === 0 ? 1.1 : 0.7,
      alpha: index % 7 === 0 ? 0.35 : 0.2,
    };
  });
}

function drawShip(ctx: CanvasRenderingContext2D, player: Player) {
  const { x, y } = player.position;

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(9, 13);
  ctx.lineTo(0, 8);
  ctx.lineTo(-9, 13);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(-14, 7);
  ctx.lineTo(0, -3);
  ctx.lineTo(14, 7);
  ctx.lineTo(0, 3);
  ctx.closePath();
  ctx.fill();

  if (player.shieldAvailable || player.invulnerableMs > 0) {
    ctx.strokeStyle = player.shieldAvailable
      ? 'rgba(56, 189, 248, 0.55)'
      : 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
  const active = bullet.ageMs >= bullet.delayMs;

  if (!active) {
    ctx.save();
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.82)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(bullet.position.x - bullet.velocity.x * 0.18, bullet.position.y - bullet.velocity.y * 0.18);
    ctx.lineTo(bullet.position.x + bullet.velocity.x * 0.18, bullet.position.y + bullet.velocity.y * 0.18);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowColor = bullet.color;
  ctx.shadowBlur = bullet.kind === 'heavy' ? 18 : 12;
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(bullet.position.x, bullet.position.y, bullet.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');

  const stars = createStars();
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * scale);
    canvas.height = Math.floor(rect.height * scale);
    ctx.setTransform(
      (rect.width * scale) / WORLD_WIDTH,
      0,
      0,
      (rect.height * scale) / WORLD_HEIGHT,
      0,
      0,
    );
  };

  return {
    resize,
    render({ elapsedMs, player, bullets }) {
      ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      const gradient = ctx.createRadialGradient(480, 320, 0, 480, 320, 650);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.7, '#020617');
      gradient.addColorStop(1, '#01030a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.save();
      ctx.filter = 'blur(0.65px)';
      for (const star of stars) {
        ctx.fillStyle = `rgba(148, 163, 184, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      for (const bullet of bullets) drawBullet(ctx, bullet);
      drawShip(ctx, player);

      const difficulty = getDifficulty(elapsedMs);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`TIME ${(elapsedMs / 1000).toFixed(2)}s`, 18, 30);
      ctx.fillText(`BULLETS ${bullets.length}/${difficulty.maxBullets}`, 18, 54);
      ctx.fillStyle = player.shieldAvailable ? '#38bdf8' : '#64748b';
      ctx.fillText(`SHIELD ${player.shieldAvailable ? 'ON' : 'USED'}`, 790, 30);
    },
  };
}
```

- [ ] **Step 3: Implement UI app shell**

Create `src/ui/app.ts`:

```ts
import { createInputController } from '../game/input';
import { createRenderer } from '../game/renderer';
import {
  createGameState,
  startGame,
  updateGameState,
  type GameState,
} from '../game/state';

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function getLocalBest(): number {
  return Number(localStorage.getItem('dodge.bestMs') ?? 0);
}

function setLocalBest(scoreMs: number) {
  localStorage.setItem('dodge.bestMs', String(Math.max(scoreMs, getLocalBest())));
}

export function mountApp(canvas: HTMLCanvasElement, overlay: HTMLElement) {
  const renderer = createRenderer(canvas);
  const input = createInputController();
  let state: GameState = createGameState();
  let lastFrame = performance.now();
  let renderedGameOver = false;

  const renderMenu = () => {
    overlay.innerHTML = `
      <div class="panel">
        <p class="eyebrow">SPACE DODGE</p>
        <h1>닷지</h1>
        <p>방향키로 우주선을 조종해서 사방에서 몰려오는 총알을 피하세요.</p>
        <button type="button" class="primary" data-action="start">Start</button>
        <p class="meta">Best ${formatTime(getLocalBest())}</p>
      </div>
    `;
  };

  const renderGameOver = () => {
    setLocalBest(state.elapsedMs);
    overlay.innerHTML = `
      <div class="panel">
        <p class="eyebrow">GAME OVER</p>
        <h1>${formatTime(state.elapsedMs)}</h1>
        <p>Best ${formatTime(getLocalBest())}</p>
        <form data-score-form>
          <label for="nickname">Nickname</label>
          <input id="nickname" name="nickname" maxlength="16" autocomplete="nickname" />
          <button type="submit" class="primary">Submit Score</button>
        </form>
        <button type="button" class="secondary" data-action="start">Restart</button>
        <div id="leaderboard"></div>
      </div>
    `;
  };

  const start = () => {
    input.reset();
    state = startGame(state);
    renderedGameOver = false;
    overlay.innerHTML = '';
  };

  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.action === 'start') start();
  });

  const frame = (now: number) => {
    const delta = now - lastFrame;
    lastFrame = now;
    state = updateGameState(state, input.current, delta);
    renderer.render(state);

    if (state.status === 'gameOver' && !renderedGameOver) {
      renderedGameOver = true;
      renderGameOver();
    }

    requestAnimationFrame(frame);
  };

  window.addEventListener('resize', renderer.resize);
  renderer.resize();
  renderMenu();
  requestAnimationFrame(frame);
}
```

- [ ] **Step 4: Wire app entry**

Replace `src/main.ts` with:

```ts
import './styles.css';
import { mountApp } from './ui/app';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const overlay = document.querySelector<HTMLElement>('#overlay');

if (!canvas || !overlay) {
  throw new Error('Missing game canvas or overlay root');
}

mountApp(canvas, overlay);
```

- [ ] **Step 5: Expand CSS for game UI**

Append to `src/styles.css`:

```css
.meta {
  margin: 14px 0 0;
  color: #94a3b8;
  font: 600 13px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

label {
  display: block;
  margin: 16px 0 6px;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 700;
}

input {
  width: 100%;
  height: 44px;
  margin-bottom: 12px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 6px;
  padding: 0 12px;
  color: #f8fafc;
  background: rgba(2, 6, 23, 0.8);
}

.secondary {
  width: 100%;
  min-height: 40px;
  margin-top: 10px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 6px;
  color: #e2e8f0;
  background: transparent;
  font-weight: 800;
  cursor: pointer;
}

#leaderboard {
  margin-top: 18px;
  color: #cbd5e1;
  font-size: 14px;
}

@media (max-width: 760px), (max-height: 560px) {
  #app {
    min-width: 0;
    min-height: 0;
    width: 100vw;
    height: 100vh;
  }

  .panel {
    width: min(360px, calc(100% - 32px));
  }
}
```

- [ ] **Step 6: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Start dev server and manually verify**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL. Open it in the in-app browser. Start the game and verify arrow keys move the ship, bullets spawn, the shield appears, and the second hit ends the run.

- [ ] **Step 8: Commit playable canvas UI**

Stop the dev server, then run:

```bash
git add src/main.ts src/styles.css src/game/input.ts src/game/renderer.ts src/ui/app.ts
git commit -m "feat: render playable dodge game"
```

Expected: commit succeeds.

## Task 5: Shared Score Validation And Leaderboard Client

**Files:**
- Create: `src/shared/scores.ts`
- Create: `src/leaderboard/client.ts`
- Modify: `src/ui/app.ts`
- Test: `tests/shared/scores.test.ts`

- [ ] **Step 1: Write shared score validation tests**

Create `tests/shared/scores.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  MAX_SURVIVAL_MS,
  normalizeNickname,
  validateScoreSubmission,
} from '../../src/shared/scores';

describe('score validation', () => {
  it('normalizes nickname whitespace and length', () => {
    expect(normalizeNickname('  pilot  ')).toBe('pilot');
    expect(normalizeNickname('abcdefghijklmnopq')).toBe('abcdefghijklmnop');
  });

  it('accepts valid submissions', () => {
    expect(validateScoreSubmission({ nickname: 'pilot', survivalMs: 12_345 })).toEqual({
      ok: true,
      nickname: 'pilot',
      survivalMs: 12_345,
    });
  });

  it('rejects invalid submissions', () => {
    expect(validateScoreSubmission({ nickname: '', survivalMs: 10 }).ok).toBe(false);
    expect(validateScoreSubmission({ nickname: 'pilot', survivalMs: 0 }).ok).toBe(false);
    expect(
      validateScoreSubmission({
        nickname: 'pilot',
        survivalMs: MAX_SURVIVAL_MS + 1,
      }).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run validation test to verify failure**

Run:

```bash
npm test -- tests/shared/scores.test.ts
```

Expected: FAIL because `src/shared/scores.ts` does not exist.

- [ ] **Step 3: Implement score validation**

Create `src/shared/scores.ts`:

```ts
export const MAX_NICKNAME_LENGTH = 16;
export const MAX_SURVIVAL_MS = 3_600_000;

export type Score = {
  nickname: string;
  survivalMs: number;
  createdAt: string;
};

export type ScoreSubmission = {
  nickname: unknown;
  survivalMs: unknown;
};

export type ScoreValidationResult =
  | { ok: true; nickname: string; survivalMs: number }
  | { ok: false; message: string };

export function normalizeNickname(value: unknown): string {
  return String(value ?? '').trim().slice(0, MAX_NICKNAME_LENGTH);
}

export function validateScoreSubmission(
  input: ScoreSubmission,
): ScoreValidationResult {
  const nickname = normalizeNickname(input.nickname);
  const survivalMs = Number(input.survivalMs);

  if (!nickname) {
    return { ok: false, message: '닉네임을 입력해주세요.' };
  }

  if (!Number.isInteger(survivalMs) || survivalMs <= 0) {
    return { ok: false, message: '점수가 올바르지 않습니다.' };
  }

  if (survivalMs > MAX_SURVIVAL_MS) {
    return { ok: false, message: '점수가 허용 범위를 벗어났습니다.' };
  }

  return { ok: true, nickname, survivalMs };
}
```

- [ ] **Step 4: Implement leaderboard client**

Create `src/leaderboard/client.ts`:

```ts
import type { Score } from '../shared/scores';

type ScoresResponse = {
  scores: Score[];
};

export async function fetchScores(): Promise<Score[]> {
  const response = await fetch('/api/scores', {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to load scores');
  }

  const data = (await response.json()) as ScoresResponse;
  return data.scores;
}

export async function submitScore(input: {
  nickname: string;
  survivalMs: number;
}): Promise<Score[]> {
  const response = await fetch('/api/scores', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Failed to submit score');
  }

  const data = (await response.json()) as ScoresResponse;
  return data.scores;
}
```

- [ ] **Step 5: Wire leaderboard into UI**

Modify `src/ui/app.ts`:

```ts
import { fetchScores, submitScore } from '../leaderboard/client';
```

Add these helper functions above `mountApp`:

```ts
function renderScores(scores: { nickname: string; survivalMs: number }[]): string {
  if (scores.length === 0) {
    return '<p class="meta">No online scores yet.</p>';
  }

  return `
    <ol class="scores">
      ${scores
        .map(
          (score) =>
            `<li><span>${score.nickname}</span><strong>${formatTime(score.survivalMs)}</strong></li>`,
        )
        .join('')}
    </ol>
  `;
}
```

Inside `mountApp`, add:

```ts
  const loadLeaderboard = async () => {
    const leaderboard = document.querySelector('#leaderboard');
    if (!leaderboard) return;

    leaderboard.innerHTML = '<p class="meta">Loading online ranking...</p>';
    try {
      leaderboard.innerHTML = renderScores(await fetchScores());
    } catch {
      leaderboard.innerHTML = '<p class="meta">Online ranking unavailable.</p>';
    }
  };
```

Call `void loadLeaderboard();` at the end of `renderMenu()` and `renderGameOver()`. In `renderMenu()`, add `<div id="leaderboard"></div>` inside the panel.

Add this form handler inside `mountApp`:

```ts
  overlay.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (!form.matches('[data-score-form]')) return;

    event.preventDefault();
    const data = new FormData(form);
    const nickname = String(data.get('nickname') ?? '');
    const leaderboard = document.querySelector('#leaderboard');

    if (leaderboard) {
      leaderboard.innerHTML = '<p class="meta">Submitting score...</p>';
    }

    void submitScore({ nickname, survivalMs: Math.round(state.elapsedMs) })
      .then((scores) => {
        if (leaderboard) leaderboard.innerHTML = renderScores(scores);
      })
      .catch((error: Error) => {
        if (leaderboard) {
          leaderboard.innerHTML = `<p class="meta">${error.message}</p>`;
        }
      });
  });
```

- [ ] **Step 6: Add score list CSS**

Append to `src/styles.css`:

```css
.scores {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 10px 0 0;
  list-style: none;
}

.scores li {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.scores span {
  overflow: hidden;
  color: #cbd5e1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scores strong {
  color: #f8fafc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

- [ ] **Step 7: Run tests and build**

Run:

```bash
npm test -- tests/shared/scores.test.ts
npm run build
```

Expected: both commands PASS.

- [ ] **Step 8: Commit leaderboard client**

Run:

```bash
git add src/shared src/leaderboard src/ui/app.ts src/styles.css tests/shared
git commit -m "feat: add leaderboard client and validation"
```

Expected: commit succeeds.

## Task 6: Cloudflare Pages Functions And D1

**Files:**
- Create: `functions/api/scores.ts`
- Create: `migrations/0001_create_scores.sql`
- Create: `wrangler.toml`
- Test: `tests/functions/scores.test.ts`

- [ ] **Step 1: Write Pages Function tests**

Create `tests/functions/scores.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { onRequestGet, onRequestPost } from '../../functions/api/scores';

type Row = {
  nickname: string;
  survival_ms: number;
  created_at: string;
};

function createFakeContext(rows: Row[] = []) {
  const state = [...rows];
  const env = {
    DB: {
      prepare(query: string) {
        return {
          bind(nickname: string, survivalMs: number) {
            return {
              async run() {
                state.push({
                  nickname,
                  survival_ms: survivalMs,
                  created_at: '2026-05-19T00:00:00.000Z',
                });
                return { success: true };
              },
            };
          },
          async all() {
            if (!query.includes('SELECT')) {
              throw new Error('Unexpected query');
            }
            return {
              results: state
                .sort((a, b) => b.survival_ms - a.survival_ms)
                .slice(0, 10),
            };
          },
        };
      },
    },
  };

  return { env, state };
}

describe('scores Pages Function', () => {
  it('returns top scores', async () => {
    const context = createFakeContext([
      { nickname: 'a', survival_ms: 1000, created_at: '2026-05-19T00:00:00.000Z' },
      { nickname: 'b', survival_ms: 3000, created_at: '2026-05-19T00:00:00.000Z' },
    ]);

    const response = await onRequestGet({ env: context.env });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scores[0].nickname).toBe('b');
  });

  it('validates and stores submitted scores', async () => {
    const context = createFakeContext();
    const request = new Request('http://example.com/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'pilot', survivalMs: 12345 }),
    });

    const response = await onRequestPost({ request, env: context.env });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scores[0].nickname).toBe('pilot');
    expect(context.state[0]?.survival_ms).toBe(12345);
  });

  it('rejects invalid payloads', async () => {
    const context = createFakeContext();
    const request = new Request('http://example.com/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: '', survivalMs: 0 }),
    });

    const response = await onRequestPost({ request, env: context.env });

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run function test to verify failure**

Run:

```bash
npm test -- tests/functions/scores.test.ts
```

Expected: FAIL because `functions/api/scores.ts` does not exist.

- [ ] **Step 3: Add D1 migration**

Create `migrations/0001_create_scores.sql`:

```sql
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  survival_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scores_survival_ms
  ON scores (survival_ms DESC, created_at ASC);
```

- [ ] **Step 4: Add Wrangler Pages config**

Create `wrangler.toml` with Pages project settings only. The D1 binding is configured in the Cloudflare dashboard so the repo does not need to store a generated database UUID.

```toml
"$schema" = "./node_modules/wrangler/config-schema.json"
name = "dodge"
pages_build_output_dir = "./dist"
compatibility_date = "2026-05-19"
```

- [ ] **Step 5: Implement Pages Function**

Create `functions/api/scores.ts`:

```ts
import {
  validateScoreSubmission,
  type Score,
} from '../../src/shared/scores';

type D1Result<T> = {
  results?: T[];
};

type D1PreparedStatement = {
  bind(...values: unknown[]): {
    run(): Promise<unknown>;
  };
  all<T>(): Promise<D1Result<T>>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type Env = {
  DB: D1Database;
};

type PagesContext = {
  request?: Request;
  env: Env;
};

type ScoreRow = {
  nickname: string;
  survival_ms: number;
  created_at: string;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

async function readTopScores(env: Env): Promise<Score[]> {
  const result = await env.DB.prepare(
    `SELECT nickname, survival_ms, created_at
     FROM scores
     ORDER BY survival_ms DESC, created_at ASC
     LIMIT 10`,
  ).all<ScoreRow>();

  return (result.results ?? []).map((row) => ({
    nickname: row.nickname,
    survivalMs: row.survival_ms,
    createdAt: row.created_at,
  }));
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  return json({ scores: await readTopScores(context.env) });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  if (!context.request) {
    return json({ error: 'Missing request' }, 500);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const payload = body as { nickname?: unknown; survivalMs?: unknown };
  const validation = validateScoreSubmission({
    nickname: payload.nickname,
    survivalMs: payload.survivalMs,
  });

  if (!validation.ok) {
    return json({ error: validation.message }, 400);
  }

  await context.env.DB.prepare(
    `INSERT INTO scores (nickname, survival_ms)
     VALUES (?, ?)`,
  )
    .bind(validation.nickname, validation.survivalMs)
    .run();

  return json({ scores: await readTopScores(context.env) });
}
```

- [ ] **Step 6: Include functions in tests without browser typecheck**

Modify `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        inline: [/functions/],
      },
    },
  },
});
```

- [ ] **Step 7: Run function and full unit tests**

Run:

```bash
npm test
npm run build
```

Expected: all unit tests PASS and Vite build succeeds.

- [ ] **Step 8: Commit Cloudflare backend**

Run:

```bash
git add functions migrations wrangler.toml vite.config.ts tests/functions
git commit -m "feat: add cloudflare leaderboard api"
```

Expected: commit succeeds.

## Task 7: Browser Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/game.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 2: Add test IDs to UI buttons**

Modify the start and restart buttons in `src/ui/app.ts`:

```html
<button type="button" class="primary" data-action="start" data-testid="start-game">Start</button>
```

```html
<button type="button" class="secondary" data-action="start" data-testid="restart-game">Restart</button>
```

- [ ] **Step 3: Write browser smoke test**

Create `tests/e2e/game.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('starts the game and moves with arrow keys', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '닷지' })).toBeVisible();

  await page.getByTestId('start-game').click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');

  const canvas = page.locator('#game');
  await expect(canvas).toBeVisible();
  await expect(page.getByText('GAME OVER')).toHaveCount(0);
});
```

- [ ] **Step 4: Install Playwright browser**

Run:

```bash
npx playwright install chromium
```

Expected: Chromium browser dependency installs successfully.

- [ ] **Step 5: Run browser verification**

Run:

```bash
npm run build
npm run e2e
```

Expected: Vite build succeeds and Playwright test passes.

- [ ] **Step 6: Commit browser verification**

Run:

```bash
git add package.json package-lock.json playwright.config.ts src/ui/app.ts tests/e2e
git commit -m "test: add browser gameplay smoke test"
```

Expected: commit succeeds.

## Task 8: Deployment Documentation And GitHub Publish

**Files:**
- Create: `README.md`
- Create: `docs/deployment/cloudflare-pages.md`

- [ ] **Step 1: Write README**

Create `README.md`:

````md
# Dodge

Arrow-key space dodge game built with Vite, TypeScript, Canvas, Cloudflare Pages Functions, and Cloudflare D1.

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
npm run e2e
```

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Functions directory: `functions`
- D1 binding: `DB`

See `docs/deployment/cloudflare-pages.md` for the setup steps.
````

- [ ] **Step 2: Write Cloudflare deployment guide**

Create `docs/deployment/cloudflare-pages.md`:

````md
# Cloudflare Pages Deployment

This project is designed for the Cloudflare free plan. The game is static during active play. The only server calls are leaderboard reads and one score submission after game over.

## 1. Create D1 Database

```bash
npx wrangler login
npx wrangler d1 create dodge-scores
```

Keep the returned database UUID available for local `wrangler pages dev` runs.

## 2. Apply Migration

```bash
npx wrangler d1 migrations apply dodge-scores --remote
```

## 3. Connect Pages

1. Open Cloudflare dashboard.
2. Go to Workers & Pages.
3. Create a Pages project from GitHub.
4. Select `nj0034/dodge`.
5. Use build command `npm run build`.
6. Use output directory `dist`.
7. Deploy from `main`.

## 4. Confirm D1 Binding

If the Pages project does not pick up `wrangler.toml`, add a dashboard binding:

- Variable name: `DB`
- Type: D1 database
- Database: `dodge-scores`

Redeploy after changing bindings.

## 5. Local Pages Function Check

Set `DATABASE_ID` to the UUID returned by `npx wrangler d1 create dodge-scores`, then run:

```bash
npm run build
npx wrangler pages dev dist --d1 DB="$DATABASE_ID"
```

## 6. Verify

- Open the deployed Pages URL.
- Start a game.
- End a run.
- Submit a nickname.
- Confirm the submitted score appears in the leaderboard.
````

- [ ] **Step 3: Run final local verification**

Run:

```bash
npm test
npm run build
npm run e2e
git status --short
```

Expected: tests and build PASS. `git status --short` shows only the README/deployment docs before committing.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add README.md docs/deployment/cloudflare-pages.md
git commit -m "docs: add deployment instructions"
```

Expected: commit succeeds.

- [ ] **Step 5: Create GitHub repository and push**

Run:

```bash
gh auth status
gh repo create nj0034/dodge --public --source=. --remote=origin --push
```

Expected: GitHub CLI is authenticated, repository `nj0034/dodge` is created, remote `origin` is added, and `main` is pushed.

If the repository already exists, run:

```bash
git remote add origin git@github.com:nj0034/dodge.git
git push -u origin main
```

Expected: `main` is pushed to GitHub.

## Final Verification Checklist

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `npm run e2e` passes.
- [ ] The game starts in a browser.
- [ ] Arrow keys move the ship.
- [ ] Stars are dim and bullets are clearly distinguishable.
- [ ] First hit consumes shield.
- [ ] Second hit triggers game over.
- [ ] Nickname validation works.
- [ ] Leaderboard API works locally with `wrangler pages dev` or fails gracefully in static preview.
- [ ] GitHub repository `nj0034/dodge` exists and `main` is pushed.
- [ ] Cloudflare Pages setup guide exists.
