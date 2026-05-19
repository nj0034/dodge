import { fetchScores, submitScore } from '../leaderboard/client';
import { createKeyboardInput, type KeyboardInput } from '../game/input';
import { createRenderer } from '../game/renderer';
import {
  createGameState,
  pauseGame,
  resumeGame,
  startGame,
  updateGameState,
  type GameState,
} from '../game/state';
import { MAX_NICKNAME_LENGTH, normalizeNickname, type Score } from '../shared/scores';
import type { InputState } from '../game/types';

const BEST_SCORE_KEY = 'dodge.bestScoreMs';
const NICKNAME_KEY = 'dodge.nickname';
const IMMEDIATE_INPUT_RESPONSE_MS = 1000 / 60;

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

const readStoredNickname = () => {
  try {
    return normalizeNickname(window.localStorage.getItem(NICKNAME_KEY) ?? '');
  } catch {
    return '';
  }
};

const writeStoredNickname = (value: string) => {
  const nickname = normalizeNickname(value);

  try {
    window.localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    return nickname;
  }

  return nickname;
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

function showMenu(overlay: HTMLElement, onStart: (nickname: string) => void) {
  const storedNickname = readStoredNickname();

  setOverlay(
    overlay,
    `
      <div class="panel menu-panel">
        <p class="eyebrow">ARROW KEY SURVIVAL</p>
        <h1>닷지</h1>
        <p class="instructions">방향키로 작은 우주선을 움직여 탄막을 피하세요. 방패는 한 번의 충돌을 막고, Space로 시작, 일시정지, 재시작할 수 있습니다.</p>
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
        <form class="nickname-form menu-nickname-form" aria-label="Pilot setup" data-nickname-form>
          <label for="home-nickname">Nickname</label>
          <div class="nickname-submit">
            <input
              id="home-nickname"
              name="nickname"
              type="text"
              value="${escapeHtml(storedNickname)}"
              placeholder="pilot"
              maxlength="${MAX_NICKNAME_LENGTH}"
              autocomplete="nickname"
              required
            />
            <button type="submit" class="primary" data-testid="start-game">Start</button>
          </div>
        </form>
      </div>
    `,
  );

  const form = overlay.querySelector<HTMLFormElement>('[data-nickname-form]');
  const input = form?.querySelector<HTMLInputElement>('input[name="nickname"]');

  input?.addEventListener('input', () => {
    input.setCustomValidity('');
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    const nickname = writeStoredNickname(String(new FormData(form).get('nickname') ?? ''));

    if (!nickname) {
      if (input) {
        input.setCustomValidity('닉네임을 입력해주세요.');
        input.reportValidity();
      }

      return;
    }

    if (input) {
      input.setCustomValidity('');
      input.value = nickname;
    }

    onStart(nickname);
  });
}

function showPaused(
  overlay: HTMLElement,
  onResume: () => void,
  onRestart: () => void,
) {
  setOverlay(
    overlay,
    `
      <div class="panel pause-panel">
        <p class="eyebrow">SYSTEM HOLD</p>
        <h1>PAUSED</h1>
        <p class="instructions">Space로 이어서 플레이하세요.</p>
        <div class="pause-actions">
          <button type="button" class="primary" data-action="resume" data-testid="resume-game">Resume</button>
          <button type="button" class="secondary" data-action="restart">Restart</button>
        </div>
      </div>
    `,
  );

  overlay.querySelector<HTMLButtonElement>('[data-action="resume"]')?.addEventListener('click', onResume);
  overlay.querySelector<HTMLButtonElement>('[data-action="restart"]')?.addEventListener('click', onRestart);
}

function showGameOver(
  overlay: HTMLElement,
  state: GameState,
  nickname: string,
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
        <p class="submit-status">닉네임 <strong>${escapeHtml(nickname)}</strong>로 리더보드에 자동 등록합니다.</p>
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
  let state = createGameState();
  let lastFrameTime = 0;
  let gameOverShown = false;
  let animationFrameId = 0;
  let disposed = false;
  let leaderboardRequestSeq = 0;
  let currentViewSeq = 0;
  let activeNickname = readStoredNickname();
  let input: KeyboardInput;

  const isEditableTarget = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);

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

      if (requestSeq === leaderboardRequestSeq && viewSeq === currentViewSeq) {
        leaderboard.innerHTML = renderScores(scores);
      }
    } catch {
      if (requestSeq === leaderboardRequestSeq && viewSeq === currentViewSeq) {
        leaderboard.innerHTML = '<p>Online ranking unavailable.</p>';
      }
    }
  };

  const submitStoredScore = async (
    nickname: string,
    survivalMs: number,
    viewSeq: number,
  ) => {
    const leaderboard = overlay.querySelector<HTMLElement>('#leaderboard');

    if (!leaderboard) {
      return;
    }

    if (!nickname) {
      leaderboard.innerHTML = '<p>닉네임을 먼저 저장해주세요.</p>';
      return;
    }

    leaderboard.innerHTML = '<p>Submitting...</p>';

    try {
      const scores = await submitScore({ nickname, survivalMs });

      if (viewSeq === currentViewSeq) {
        leaderboard.innerHTML = renderScores(scores);
      }
    } catch (error: unknown) {
      if (viewSeq === currentViewSeq) {
        const message = error instanceof Error ? error.message : 'Online ranking unavailable.';
        leaderboard.innerHTML = `<p>${escapeHtml(message)}</p>`;
      }
    }
  };

  const syncGameOverView = () => {
    if (state.status !== 'gameOver' || gameOverShown) {
      return;
    }

    gameOverShown = true;
    input.reset();
    currentViewSeq += 1;
    activeNickname = readStoredNickname() || activeNickname;
    showGameOver(overlay, state, activeNickname, restart);
    void submitStoredScore(activeNickname, Math.round(state.elapsedMs), currentViewSeq);
  };

  const advanceGame = (inputState: InputState, deltaMs: number) => {
    state = updateGameState(state, inputState, deltaMs);
    renderer.render(state);
    syncGameOverView();
  };

  const handleImmediateDirectionPressed = (inputState: InputState) => {
    if (state.status !== 'playing') {
      return;
    }

    const now = performance.now();
    const elapsedSinceLastFrameMs = lastFrameTime === 0 ? 0 : now - lastFrameTime;
    const deltaMs = Math.max(elapsedSinceLastFrameMs, IMMEDIATE_INPUT_RESPONSE_MS);

    lastFrameTime = now;
    advanceGame(inputState, deltaMs);
  };

  input = createKeyboardInput(window, {
    onDirectionPressed: handleImmediateDirectionPressed,
  });

  const restart = (nextNickname?: string) => {
    const fallbackNickname = readStoredNickname() || activeNickname;
    const normalizedNickname = normalizeNickname(nextNickname ?? fallbackNickname);

    if (normalizedNickname) {
      activeNickname = normalizedNickname;
    }

    input.reset();
    state = startGame(state);
    lastFrameTime = performance.now();
    gameOverShown = false;
    currentViewSeq += 1;
    clearOverlay(overlay);
  };

  const pause = () => {
    const paused = pauseGame(state);

    if (paused === state) {
      return;
    }

    input.reset();
    state = paused;
    showPaused(overlay, resume, restart);
  };

  const resume = () => {
    const resumed = resumeGame(state);

    if (resumed === state) {
      return;
    }

    input.reset();
    state = resumed;
    lastFrameTime = performance.now();
    clearOverlay(overlay);
  };

  const handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || event.repeat || isEditableTarget(event.target)) {
      return;
    }

    event.preventDefault();

    if (state.status === 'playing') {
      pause();
      return;
    }

    if (state.status === 'paused') {
      resume();
      return;
    }

    const nicknameForm = overlay.querySelector<HTMLFormElement>('[data-nickname-form]');

    if (nicknameForm) {
      nicknameForm.requestSubmit();
      return;
    }

    restart();
  };

  const loop = (time: number) => {
    if (disposed) {
      return;
    }

    const deltaMs = lastFrameTime === 0 ? 0 : time - lastFrameTime;
    lastFrameTime = time;

    advanceGame(input.current, deltaMs);

    animationFrameId = requestAnimationFrame(loop);
  };

  const handleResize = () => {
    renderer.resize();
    renderer.render(state);
  };

  root.classList.add('is-mounted');
  currentViewSeq += 1;
  showMenu(overlay, restart);
  void loadLeaderboard();
  renderer.render(state);
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleGlobalKeyDown, { passive: false });
  animationFrameId = requestAnimationFrame(loop);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrameId);
    input.dispose();
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleGlobalKeyDown);
  };
}
