import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchScores, submitScore } from '../../src/leaderboard/client';
import type { Score } from '../../src/shared/scores';

const scores: Score[] = [
  { nickname: 'pilot', survivalMs: 12_345, createdAt: '2026-05-19T00:00:00.000Z' },
];

function mockFetch(response: Response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

describe('leaderboard client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchScores returns scores on ok JSON', async () => {
    mockFetch(Response.json({ scores }));

    await expect(fetchScores()).resolves.toEqual(scores);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores');
  });

  it('fetchScores throws the server error on non-ok JSON', async () => {
    mockFetch(Response.json({ error: 'Try again later.' }, { status: 503 }));

    await expect(fetchScores()).rejects.toThrow('Try again later.');
  });

  it('submitScore throws the server error on non-ok JSON', async () => {
    mockFetch(Response.json({ error: 'Nickname is required.' }, { status: 400 }));

    await expect(submitScore({ nickname: '', survivalMs: 10 })).rejects.toThrow('Nickname is required.');
  });
});
