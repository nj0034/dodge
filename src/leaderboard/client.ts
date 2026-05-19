import type { Score } from '../shared/scores';

type ScoresResponse = {
  scores: Score[];
};

type ErrorResponse = {
  error?: string;
};

const INVALID_RESPONSE_MESSAGE = 'Leaderboard response was invalid.';

function isScore(value: unknown): value is Score {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const score = value as Record<string, unknown>;

  return (
    typeof score.nickname === 'string' &&
    typeof score.survivalMs === 'number' &&
    Number.isFinite(score.survivalMs) &&
    typeof score.createdAt === 'string'
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ErrorResponse;

    if (typeof data.error === 'string' && data.error) {
      return data.error;
    }
  } catch {
    return 'Leaderboard request failed.';
  }

  return 'Leaderboard request failed.';
}

async function readScores(response: Response): Promise<Score[]> {
  try {
    const data = (await response.json()) as ScoresResponse;

    if (Array.isArray(data.scores) && data.scores.every(isScore)) {
      return data.scores;
    }
  } catch {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }

  throw new Error(INVALID_RESPONSE_MESSAGE);
}

export async function fetchScores(): Promise<Score[]> {
  const response = await fetch('/api/scores');

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return readScores(response);
}

export async function submitScore({
  nickname,
  survivalMs,
}: {
  nickname: string;
  survivalMs: number;
}): Promise<Score[]> {
  const response = await fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, survivalMs }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return readScores(response);
}
