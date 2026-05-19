import { createKeyboardInput } from '../game/input';
import { createRenderer } from '../game/renderer';
import {
  createGameState,
  startGame,
  updateGameState,
  type GameState,
} from '../game/state';

const BEST_SCORE_KEY = 'dodge.bestScoreMs';

type AppElements = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
};

const readBestScore = () => {
  try {
    const value = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = value === null ? 0 : Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  } catch {
    return 0;
  }
};

const writeBestScore = (score: number) => {
  const previous = readBestScore();
  const next = Math.max(0, previous, score);

  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(next));
  } catch {
    return next;
  }

  return next;
};

const formatScore = (elapsedMs: number) => `${(elapsedMs / 1000).toFixed(1)}s`;

function setOverlay(overlay: HTMLElement, html: string) {
  overlay.innerHTML = html;
  overlay.hidden = false;
}

function clearOverlay(overlay: HTMLElement) {
  overlay.innerHTML = '';
  overlay.hidden = true;
}

function showMenu(overlay: HTMLElement, onStart: () => void) {
  setOverlay(
    overlay,
    `
      <div class="panel menu-panel">
        <p class="eyebrow">ARROW KEY SURVIVAL</p>
        <h1>닷지</h1>
        <p class="instructions">방향키로 작은 우주선을 움직여 탄막을 피하세요. 방패는 한 번의 충돌을 막아줍니다.</p>
        <dl class="score-row">
          <div>
            <dt>Local best</dt>
            <dd>${formatScore(readBestScore())}</dd>
          </div>
        </dl>
        <button type="button" class="primary" data-action="start">Start</button>
      </div>
    `,
  );

  overlay.querySelector<HTMLButtonElement>('[data-action="start"]')?.addEventListener('click', onStart);
}

function showGameOver(
  overlay: HTMLElement,
  state: GameState,
  onRestart: () => void,
) {
  const score = state.elapsedMs;
  const best = writeBestScore(score);

  setOverlay(
    overlay,
    `
      <div class="panel game-over-panel">
        <p class="eyebrow">GAME OVER</p>
        <h1>기록 ${formatScore(score)}</h1>
        <dl class="score-grid">
          <div>
            <dt>Score</dt>
            <dd>${formatScore(score)}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd>${formatScore(best)}</dd>
          </div>
        </dl>
        <form class="nickname-form" aria-label="Nickname form">
          <label for="nickname">Nickname</label>
          <input id="nickname" name="nickname" type="text" placeholder="다음 작업에서 저장됩니다" disabled />
        </form>
        <button type="button" class="primary" data-action="restart">Restart</button>
        <section class="leaderboard" aria-label="Leaderboard">
          <h2>Leaderboard</h2>
          <p>네트워크 순위표는 다음 작업에서 연결됩니다.</p>
        </section>
      </div>
    `,
  );

  overlay.querySelector<HTMLButtonElement>('[data-action="restart"]')?.addEventListener('click', onRestart);
}

export function mountApp({ root, canvas, overlay }: AppElements) {
  const renderer = createRenderer(canvas);
  const input = createKeyboardInput();
  let state = createGameState();
  let lastFrameTime = 0;
  let gameOverShown = false;
  let animationFrameId = 0;
  let disposed = false;

  const restart = () => {
    input.reset();
    state = startGame(state);
    lastFrameTime = performance.now();
    gameOverShown = false;
    clearOverlay(overlay);
  };

  const loop = (time: number) => {
    if (disposed) {
      return;
    }

    const deltaMs = lastFrameTime === 0 ? 0 : time - lastFrameTime;
    lastFrameTime = time;

    state = updateGameState(state, input.current, deltaMs);
    renderer.render(state);

    if (state.status === 'gameOver' && !gameOverShown) {
      gameOverShown = true;
      input.reset();
      showGameOver(overlay, state, restart);
    }

    animationFrameId = requestAnimationFrame(loop);
  };

  const handleResize = () => {
    renderer.resize();
    renderer.render(state);
  };

  root.classList.add('is-mounted');
  showMenu(overlay, restart);
  renderer.render(state);
  window.addEventListener('resize', handleResize);
  animationFrameId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    input.dispose();
    window.removeEventListener('resize', handleResize);
  };
}
