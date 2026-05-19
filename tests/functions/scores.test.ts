import { onRequestGet, onRequestPost } from '../../functions/api/scores';
import type { Score } from '../../src/shared/scores';

type StoredScore = {
  nickname: string;
  survival_ms: number;
  created_at: string;
};

type FakeD1Result = {
  results: StoredScore[];
};

class FakeD1Database {
  private insertCount = 0;

  constructor(private readonly scores: StoredScore[] = []) {}

  prepare(sql: string) {
    const statement = {
      bind: (nickname: string, survivalMs: number) => ({
        ...statement,
        run: async () => {
          this.insertCount += 1;
          this.scores.push({
            nickname,
            survival_ms: survivalMs,
            created_at: `2026-05-19T00:00:0${this.insertCount}.000Z`,
          });
        },
      }),
      all: async (): Promise<FakeD1Result> => {
        if (!sql.includes('ORDER BY survival_ms DESC, created_at ASC')) {
          throw new Error(`Unexpected select query: ${sql}`);
        }

        return {
          results: [...this.scores]
            .sort((a, b) => b.survival_ms - a.survival_ms || a.created_at.localeCompare(b.created_at))
            .slice(0, 10),
        };
      },
      run: async () => {
        throw new Error(`Unexpected run query: ${sql}`);
      },
    };

    return statement;
  }
}

type ScoresResponse = {
  scores: Score[];
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function createContext(request: Request, db: FakeD1Database) {
  return {
    request,
    env: {
      DB: db,
    },
  };
}

describe('/api/scores Pages Function', () => {
  it('returns top scores sorted descending by survival time', async () => {
    const db = new FakeD1Database([
      { nickname: 'Second', survival_ms: 9000, created_at: '2026-05-19T00:00:02.000Z' },
      { nickname: 'First', survival_ms: 12000, created_at: '2026-05-19T00:00:03.000Z' },
      { nickname: 'TieBreaker', survival_ms: 12000, created_at: '2026-05-19T00:00:01.000Z' },
    ]);

    const response = await onRequestGet(createContext(new Request('https://dodge.test/api/scores'), db));
    const body = await readJson<ScoresResponse>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.scores).toEqual([
      { nickname: 'TieBreaker', survivalMs: 12000, createdAt: '2026-05-19T00:00:01.000Z' },
      { nickname: 'First', survivalMs: 12000, createdAt: '2026-05-19T00:00:03.000Z' },
      { nickname: 'Second', survivalMs: 9000, createdAt: '2026-05-19T00:00:02.000Z' },
    ]);
  });

  it('validates and stores submitted scores', async () => {
    const db = new FakeD1Database([{ nickname: 'Existing', survival_ms: 7000, created_at: '2026-05-19T00:00:00.000Z' }]);
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: ' Player ', survivalMs: 11000 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));
    const body = await readJson<ScoresResponse>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.scores).toEqual([
      { nickname: 'Player', survivalMs: 11000, createdAt: '2026-05-19T00:00:01.000Z' },
      { nickname: 'Existing', survivalMs: 7000, createdAt: '2026-05-19T00:00:00.000Z' },
    ]);
  });

  it('returns 400 for invalid payloads', async () => {
    const db = new FakeD1Database();
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: '', survivalMs: 11000 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));

    expect(response.status).toBe(400);
  });
});
