import { WORLD_HEIGHT, WORLD_WIDTH } from './config';
import { circlesOverlap } from './collision';
import { getDifficulty } from './difficulty';
import {
  chooseBulletKind,
  spawnBullet,
  updateBullets,
} from './bullets';
import { createPlayer, movePlayer, registerPlayerHit } from './player';
import { createRng, type Rng } from './rng';
import type { Bounds, Bullet, Difficulty, InputState, Player } from './types';

export type GameStatus = 'ready' | 'playing' | 'gameOver';

export type GameState = {
  status: GameStatus;
  bounds: Bounds;
  player: Player;
  bullets: Bullet[];
  elapsedMs: number;
  spawnTimerMs: number;
  nextBulletId: number;
  difficulty: Difficulty;
  rng: Rng;
  seed: number;
};

const WORLD_BOUNDS: Bounds = {
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
};

export function createGameState(seed = Date.now()): GameState {
  return {
    status: 'ready',
    bounds: WORLD_BOUNDS,
    player: createPlayer(WORLD_WIDTH, WORLD_HEIGHT),
    bullets: [],
    elapsedMs: 0,
    spawnTimerMs: 0,
    nextBulletId: 1,
    difficulty: getDifficulty(0),
    rng: createRng(seed),
    seed,
  };
}

export function startGame(state: GameState): GameState {
  return {
    ...createGameState(state.seed),
    status: 'playing',
  };
}

function spawnDueBullets(state: GameState, deltaMs: number): GameState {
  let spawnTimerMs = state.spawnTimerMs + deltaMs;
  let nextBulletId = state.nextBulletId;
  let bullets = state.bullets;

  while (
    spawnTimerMs >= state.difficulty.spawnIntervalMs &&
    bullets.length < state.difficulty.maxBullets
  ) {
    const kind = chooseBulletKind(state.difficulty.unlockedKinds, state.rng);
    const bullet = spawnBullet({
      id: nextBulletId,
      rng: state.rng,
      bounds: state.bounds,
      playerPosition: state.player.position,
      elapsedMs: state.elapsedMs,
      kind,
      speed: state.difficulty.baseSpeed,
    });

    bullets = [...bullets, bullet];
    nextBulletId += 1;
    spawnTimerMs -= state.difficulty.spawnIntervalMs;
  }

  return {
    ...state,
    bullets,
    nextBulletId,
    spawnTimerMs,
  };
}

function resolvePlayerCollisions(player: Player, bullets: Bullet[]): Player {
  let nextPlayer = player;

  for (const bullet of bullets) {
    if (bullet.kind === 'dash' && bullet.ageMs < bullet.delayMs) {
      continue;
    }

    if (
      circlesOverlap(
        { ...nextPlayer.position, radius: nextPlayer.radius },
        { ...bullet.position, radius: bullet.radius },
      )
    ) {
      nextPlayer = registerPlayerHit(nextPlayer);
    }
  }

  return nextPlayer;
}

export function updateGameState(
  state: GameState,
  input: InputState,
  deltaMs: number,
): GameState {
  if (state.status !== 'playing') {
    return state;
  }

  const elapsedMs = state.elapsedMs + deltaMs;
  const difficulty = getDifficulty(elapsedMs);
  const player = movePlayer(state.player, input, deltaMs, state.bounds);
  const updated = updateBullets(
    state.bullets,
    deltaMs,
    state.bounds,
    state.nextBulletId,
  );
  const preparedState = spawnDueBullets(
    {
      ...state,
      player,
      bullets: updated.bullets,
      nextBulletId: updated.nextId,
      elapsedMs,
      difficulty,
    },
    deltaMs,
  );
  const nextPlayer = resolvePlayerCollisions(
    preparedState.player,
    preparedState.bullets,
  );

  return {
    ...preparedState,
    player: nextPlayer,
    status: nextPlayer.alive ? 'playing' : 'gameOver',
  };
}
