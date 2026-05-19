import { WORLD_HEIGHT, WORLD_WIDTH } from './config';
import type { Bullet, Vec2 } from './types';
import type { GameState } from './state';

type Renderer = {
  resize: () => void;
  render: (state: GameState) => void;
};

type Star = Vec2 & {
  radius: number;
  alpha: number;
  blur: number;
};

const STAR_COUNT = 230;
const WARNING_LINE_LENGTH = 2000;
const HUD_SCALE = WORLD_WIDTH / 1280;
const PLAYER_SHIP_SCALE = 1.18;

const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, index) => {
  const seed = Math.sin((index + 1) * 97.31) * 10000;
  const next = (offset: number) => {
    const value = Math.sin(seed + offset * 41.73) * 10000;
    return value - Math.floor(value);
  };

  return {
    x: next(1) * WORLD_WIDTH,
    y: next(2) * WORLD_HEIGHT,
    radius: 0.7 + next(3) * 1.6,
    alpha: 0.09 + next(4) * 0.14,
    blur: 6 + next(5) * 11,
  };
});

const formatSeconds = (elapsedMs: number) =>
  `${Math.floor(elapsedMs / 1000).toString().padStart(2, '0')}s`;

const normalize = (value: Vec2): Vec2 => {
  const length = Math.hypot(value.x, value.y) || 1;
  return { x: value.x / length, y: value.y / length };
};

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createRadialGradient(
    WORLD_WIDTH * 0.48,
    WORLD_HEIGHT * 0.42,
    40,
    WORLD_WIDTH * 0.5,
    WORLD_HEIGHT * 0.5,
    WORLD_WIDTH * 0.72,
  );

  gradient.addColorStop(0, '#10182b');
  gradient.addColorStop(0.48, '#050816');
  gradient.addColorStop(1, '#01030a');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (const star of stars) {
    ctx.save();
    ctx.globalAlpha = star.alpha;
    ctx.shadowBlur = star.blur;
    ctx.shadowColor = '#6b88a8';
    ctx.fillStyle = '#8da2bc';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDashWarning(ctx: CanvasRenderingContext2D, bullet: Bullet) {
  if (bullet.kind !== 'dash' || bullet.ageMs >= bullet.delayMs) {
    return;
  }

  const direction = normalize(bullet.velocity);
  const progress = Math.min(1, bullet.ageMs / bullet.delayMs);
  const end = {
    x: bullet.position.x + direction.x * WARNING_LINE_LENGTH,
    y: bullet.position.y + direction.y * WARNING_LINE_LENGTH,
  };

  ctx.save();
  ctx.globalAlpha = 0.22 + progress * 0.34;
  ctx.strokeStyle = bullet.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.lineDashOffset = -progress * 32;
  ctx.shadowBlur = 12;
  ctx.shadowColor = bullet.color;
  ctx.beginPath();
  ctx.moveTo(bullet.position.x, bullet.position.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet) {
  const isWaitingDash = bullet.kind === 'dash' && bullet.ageMs < bullet.delayMs;
  const radius = isWaitingDash ? bullet.radius * 0.82 : bullet.radius;

  ctx.save();
  ctx.globalAlpha = isWaitingDash ? 0.62 : 1;
  ctx.shadowBlur = isWaitingDash ? 10 : 18;
  ctx.shadowColor = bullet.color;
  ctx.fillStyle = bullet.color;
  ctx.beginPath();
  ctx.arc(bullet.position.x, bullet.position.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = isWaitingDash ? 0.36 : 0.7;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  const { player } = state;
  const { x, y } = player.position;
  const invulnerable = player.invulnerableMs > 0;

  ctx.save();
  ctx.translate(x, y);

  if (player.shieldAvailable || invulnerable) {
    ctx.globalAlpha = invulnerable ? 0.45 + Math.sin(state.elapsedMs / 70) * 0.2 : 0.34;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#22d3ee';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 14, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = player.alive ? 1 : 0.35;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(PLAYER_SHIP_SCALE, PLAYER_SHIP_SCALE);

  ctx.shadowBlur = 10;
  ctx.shadowColor = '#60a5fa';
  ctx.fillStyle = '#020617';
  ctx.fillRect(-4, -18, 8, 4);
  ctx.fillRect(-8, -14, 16, 4);
  ctx.fillRect(-10, -10, 20, 8);
  ctx.fillRect(-16, -2, 32, 10);
  ctx.fillRect(-20, 8, 40, 8);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-2, -18, 4, 4);
  ctx.fillRect(-5, -14, 10, 4);
  ctx.fillRect(-6, -10, 12, 8);
  ctx.fillRect(-7, -2, 14, 16);

  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(-3, -10, 6, 6);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(-2, -8, 4, 4);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-12, -2, 5, 12);
  ctx.fillRect(7, -2, 5, 12);
  ctx.fillRect(-17, 6, 5, 9);
  ctx.fillRect(12, 6, 5, 9);

  ctx.fillStyle = '#fef2f2';
  ctx.fillRect(-9, 2, 2, 5);
  ctx.fillRect(7, 2, 2, 5);

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(-6, 12, 4, 5);
  ctx.fillRect(2, 12, 4, 5);
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-4, 17, 2, 4);
  ctx.fillRect(2, 17, 2, 4);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-1, -17, 2, 3);
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState) {
  const shieldText =
    state.player.shieldAvailable || state.player.invulnerableMs > 0 ? 'SHIELD ON' : 'SHIELD OFF';

  ctx.save();
  ctx.scale(HUD_SCALE, HUD_SCALE);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(18, 18, 312, 40, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 14px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatSeconds(state.elapsedMs), 34, 38);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText(`BULLETS ${state.bullets.length}`, 112, 38);

  ctx.fillStyle =
    state.player.shieldAvailable || state.player.invulnerableMs > 0 ? '#67e8f9' : '#64748b';
  ctx.fillText(shieldText, 220, 38);
  ctx.restore();
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(
      (rect.width * dpr) / WORLD_WIDTH,
      0,
      0,
      (rect.height * dpr) / WORLD_HEIGHT,
      0,
      0,
    );
  };

  const render = (state: GameState) => {
    drawBackground(ctx);

    for (const bullet of state.bullets) {
      drawDashWarning(ctx, bullet);
    }

    for (const bullet of state.bullets) {
      drawBullet(ctx, bullet);
    }

    drawPlayer(ctx, state);
    drawHud(ctx, state);
  };

  resize();

  return { resize, render };
}
