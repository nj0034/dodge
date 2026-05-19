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

type FakeD1Options = {
  throwOnAll?: boolean;
  throwOnRun?: boolean;
};

class FakeD1Database {
  private insertCount = 0;

  constructor(
    private readonly scores: StoredScore[] = [],
    private readonly options: FakeD1Options = {},
  ) {}

  records() {
    return [...this.scores];
  }

  prepare(sql: string) {
    const statement = {
      bind: (nickname: string, survivalMs: number) => ({
        ...statement,
        all: async (): Promise<FakeD1Result> => {
          if (!sql.includes('WHERE nickname = ?')) {
            throw new Error(`Unexpected bound select query: ${sql}`);
          }
          if (this.options.throwOnAll) {
            throw new Error('D1 select failed');
          }

          return {
            results: [...this.scores]
              .filter((score) => score.nickname === nickname)
              .sort((a, b) => b.survival_ms - a.survival_ms || a.created_at.localeCompare(b.created_at))
              .slice(0, 1),
          };
        },
        run: async () => {
          if (sql.includes('DELETE FROM scores WHERE nickname = ?')) {
            for (let index = this.scores.length - 1; index >= 0; index -= 1) {
              if (this.scores[index]?.nickname === nickname) {
                this.scores.splice(index, 1);
              }
            }

            return;
          }

          if (
            !sql.includes('INSERT INTO scores (nickname, survival_ms)') ||
            !sql.includes('VALUES (?, ?)')
          ) {
            throw new Error(`Unexpected bound run query: ${sql}`);
          }
          if (this.options.throwOnRun) {
            throw new Error('D1 insert failed');
          }

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
        if (this.options.throwOnAll) {
          throw new Error('D1 select failed');
        }

        const bestByNickname = new Map<string, StoredScore>();

        for (const score of this.scores) {
          const previous = bestByNickname.get(score.nickname);

          if (
            previous === undefined ||
            score.survival_ms > previous.survival_ms ||
            (score.survival_ms === previous.survival_ms && score.created_at < previous.created_at)
          ) {
            bestByNickname.set(score.nickname, score);
          }
        }

        const source = sql.includes('PARTITION BY nickname')
          ? [...bestByNickname.values()]
          : [...this.scores];

        return {
          results: source
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

type ErrorResponse = {
  error?: string;
  message?: string;
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

async function expectErrorResponse(response: Response, status: number, error: string): Promise<void> {
  const body = await readJson<ErrorResponse>(response);

  expect(response.status).toBe(status);
  expect(body.error).toBe(error);
  expect(body.message).toBeUndefined();
}

describe('/api/scores Pages Function', () => {
  it('returns top scores sorted descending by survival time', async () => {
    const db = new FakeD1Database([
      { nickname: 'Second', survival_ms: 9000, created_at: '2026-05-19T00:00:02.000Z' },
      { nickname: 'First', survival_ms: 12000, created_at: '2026-05-19T00:00:03.000Z' },
      { nickname: 'First', survival_ms: 8000, created_at: '2026-05-19T00:00:00.000Z' },
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

  it('does not store a submitted score below an existing nickname best', async () => {
    const db = new FakeD1Database([
      { nickname: 'Player', survival_ms: 12000, created_at: '2026-05-19T00:00:00.000Z' },
    ]);
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Player', survivalMs: 9000 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));
    const body = await readJson<ScoresResponse>(response);

    expect(response.status).toBe(200);
    expect(body.scores).toEqual([
      { nickname: 'Player', survivalMs: 12000, createdAt: '2026-05-19T00:00:00.000Z' },
    ]);
    expect(db.records()).toEqual([
      { nickname: 'Player', survival_ms: 12000, created_at: '2026-05-19T00:00:00.000Z' },
    ]);
  });

  it('replaces an existing nickname score only when the submitted score is higher', async () => {
    const db = new FakeD1Database([
      { nickname: 'Player', survival_ms: 7000, created_at: '2026-05-19T00:00:00.000Z' },
      { nickname: 'Other', survival_ms: 9000, created_at: '2026-05-19T00:00:02.000Z' },
    ]);
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Player', survivalMs: 11000 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));
    const body = await readJson<ScoresResponse>(response);

    expect(response.status).toBe(200);
    expect(body.scores).toEqual([
      { nickname: 'Player', survivalMs: 11000, createdAt: '2026-05-19T00:00:01.000Z' },
      { nickname: 'Other', survivalMs: 9000, createdAt: '2026-05-19T00:00:02.000Z' },
    ]);
    expect(db.records()).toEqual([
      { nickname: 'Other', survival_ms: 9000, created_at: '2026-05-19T00:00:02.000Z' },
      { nickname: 'Player', survival_ms: 11000, created_at: '2026-05-19T00:00:01.000Z' },
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

    await expectErrorResponse(response, 400, '닉네임을 입력해주세요.');
  });

  it('returns 400 with an error for invalid JSON', async () => {
    const db = new FakeD1Database();
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: '{not valid json',
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));

    await expectErrorResponse(response, 400, 'Invalid JSON payload');
  });

  it('returns 400 with an error for null JSON payloads', async () => {
    const db = new FakeD1Database();
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify(null),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));

    await expectErrorResponse(response, 400, 'Invalid score payload');
  });

  it('returns 500 with an error when reading top scores fails', async () => {
    const db = new FakeD1Database([], { throwOnAll: true });

    const response = await onRequestGet(createContext(new Request('https://dodge.test/api/scores'), db));

    await expectErrorResponse(response, 500, 'Leaderboard request failed.');
  });

  it('returns 500 with an error when score insert fails', async () => {
    const db = new FakeD1Database([], { throwOnRun: true });
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Player', survivalMs: 11000 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));

    await expectErrorResponse(response, 500, 'Leaderboard request failed.');
  });

  it('returns 500 with an error when score refresh fails after insert', async () => {
    const db = new FakeD1Database([], { throwOnAll: true });
    const request = new Request('https://dodge.test/api/scores', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Player', survivalMs: 11000 }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await onRequestPost(createContext(request, db));

    await expectErrorResponse(response, 500, 'Leaderboard request failed.');
  });
});
