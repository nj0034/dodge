import type { Score } from '../shared/scores';

type ScoresResponse = {
  scores: Score[];
};

type ErrorResponse = {
  error?: string;
};

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

export async function fetchScores(): Promise<Score[]> {
  const response = await fetch('/api/scores');

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = (await response.json()) as ScoresResponse;
  return data.scores;
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

  const data = (await response.json()) as ScoresResponse;
  return data.scores;
}
