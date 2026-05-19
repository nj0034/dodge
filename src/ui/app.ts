import { fetchScores, submitScore } from '../leaderboard/client';
import { createKeyboardInput } from '../game/input';
import { createRenderer } from '../game/renderer';
import {
  createGameState,
  startGame,
  updateGameState,
  type GameState,
} from '../game/state';
import type { Score } from '../shared/scores';

const BEST_SCORE_KEY = 'dodge.bestScoreMs';

type AppElements = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
};

const readBestScore = () => {
  try {
    const value = window.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = value === null ? 0 : Number(value);

    return Number.isFinite(parsed) && Number.isInteger(parsed) ? Math.max(0, parsed) : 0;
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

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function renderScores(scores: Score[]) {
  if (scores.length === 0) {
    return '<p>No online scores yet.</p>';
  }

  return `
    <ol class="score-list">
      ${scores
        .map(
          (score) => `
            <li>
              <span>${escapeHtml(score.nickname)}</span>
              <strong>${formatScore(score.survivalMs)}</strong>
            </li>
          `,
        )
        .join('')}
    </ol>
  `;
}

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
        <section class="leaderboard" aria-label="Leaderboard">
          <h2>Leaderboard</h2>
          <div id="leaderboard"></div>
        </section>
        <button type="button" class="primary" data-action="start" data-testid="start-game">Start</button>
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
        <form class="nickname-form" aria-label="Nickname form" data-score-form>
          <label for="nickname">Nickname</label>
          <div class="nickname-submit">
            <input id="nickname" name="nickname" type="text" placeholder="pilot" maxlength="16" autocomplete="nickname" />
            <button type="submit">Submit</button>
          </div>
        </form>
        <button type="button" class="primary" data-action="restart" data-testid="restart-game">Restart</button>
        <section class="leaderboard" aria-label="Leaderboard">
          <h2>Leaderboard</h2>
          <div id="leaderboard"></div>
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
  let leaderboardRequestSeq = 0;
  let currentViewSeq = 0;
  let submitStartedViewSeq = 0;
  let scoreSubmitInFlight = false;
  let scoreSubmitSucceeded = false;

  const loadLeaderboard = async () => {
    const leaderboard = overlay.querySelector<HTMLElement>('#leaderboard');
    const requestSeq = ++leaderboardRequestSeq;
    const viewSeq = currentViewSeq;

    if (!leaderboard) {
      return;
    }

    leaderboard.innerHTML = '<p>Loading...</p>';

    try {
      const scores = await fetchScores();

      if (requestSeq === leaderboardRequestSeq && viewSeq === currentViewSeq && submitStartedViewSeq !== viewSeq) {
        leaderboard.innerHTML = renderScores(scores);
      }
    } catch {
      if (requestSeq === leaderboardRequestSeq && viewSeq === currentViewSeq && submitStartedViewSeq !== viewSeq) {
        leaderboard.innerHTML = '<p>Online ranking unavailable.</p>';
      }
    }
  };

  const restart = () => {
    input.reset();
    state = startGame(state);
    lastFrameTime = performance.now();
    gameOverShown = false;
    currentViewSeq += 1;
    scoreSubmitInFlight = false;
    scoreSubmitSucceeded = false;
    submitStartedViewSeq = 0;
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
      currentViewSeq += 1;
      scoreSubmitInFlight = false;
      scoreSubmitSucceeded = false;
      submitStartedViewSeq = 0;
      showGameOver(overlay, state, restart);
      void loadLeaderboard();
    }

    animationFrameId = requestAnimationFrame(loop);
  };

  const handleResize = () => {
    renderer.resize();
    renderer.render(state);
  };

  const handleScoreSubmit = (event: SubmitEvent) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;

    if (!form?.matches('[data-score-form]')) {
      return;
    }

    event.preventDefault();

    if (scoreSubmitInFlight || scoreSubmitSucceeded) {
      return;
    }

    const leaderboard = overlay.querySelector<HTMLElement>('#leaderboard');
    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const nickname = String(new FormData(form).get('nickname') ?? '');
    const viewSeq = currentViewSeq;

    scoreSubmitInFlight = true;
    submitStartedViewSeq = viewSeq;

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (leaderboard) {
      leaderboard.innerHTML = '<p>Submitting...</p>';
    }

    void submitScore({ nickname, survivalMs: Math.round(state.elapsedMs) })
      .then((scores) => {
        if (leaderboard && viewSeq === currentViewSeq) {
          scoreSubmitSucceeded = true;
          leaderboard.innerHTML = renderScores(scores);
        }
      })
      .catch((error: unknown) => {
        if (viewSeq === currentViewSeq) {
          scoreSubmitInFlight = false;

          if (submitButton) {
            submitButton.disabled = false;
          }
        }

        if (leaderboard && viewSeq === currentViewSeq) {
          const message = error instanceof Error ? error.message : 'Online ranking unavailable.';
          leaderboard.innerHTML = `<p>${escapeHtml(message)}</p>`;
        }
      });
  };

  root.classList.add('is-mounted');
  currentViewSeq += 1;
  showMenu(overlay, restart);
  void loadLeaderboard();
  renderer.render(state);
  window.addEventListener('resize', handleResize);
  overlay.addEventListener('submit', handleScoreSubmit);
  animationFrameId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    input.dispose();
    window.removeEventListener('resize', handleResize);
    overlay.removeEventListener('submit', handleScoreSubmit);
  };
}
