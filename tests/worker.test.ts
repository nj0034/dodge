import worker from '../src/worker';

type StoredScore = {
  nickname: string;
  survival_ms: number;
  created_at: string;
};

class FakeD1Database {
  constructor(private readonly scores: StoredScore[] = []) {}

  prepare(sql: string) {
    return {
      bind: () => {
        throw new Error(`Unexpected bind query: ${sql}`);
      },
      all: async () => ({
        results: [...this.scores],
      }),
      run: async () => {
        throw new Error(`Unexpected run query: ${sql}`);
      },
    };
  }
}

const createEnv = (scores: StoredScore[] = []) => ({
  DB: new FakeD1Database(scores),
  ASSETS: {
    fetch: async () => new Response('asset response', { status: 209 }),
  },
});

describe('Worker app', () => {
  it('routes leaderboard API requests through the Worker', async () => {
    const response = await worker.fetch(
      new Request('https://dodge.test/api/scores'),
      createEnv([
        {
          nickname: 'Pilot',
          survival_ms: 9000,
          created_at: '2026-05-19T00:00:00.000Z',
        },
      ]),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      scores: [
        {
          nickname: 'Pilot',
          survivalMs: 9000,
          createdAt: '2026-05-19T00:00:00.000Z',
        },
      ],
    });
  });

  it('serves non-API requests from static assets', async () => {
    const response = await worker.fetch(
      new Request('https://dodge.test/'),
      createEnv(),
    );

    expect(response.status).toBe(209);
    expect(await response.text()).toBe('asset response');
  });
});
