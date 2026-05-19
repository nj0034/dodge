import { validateScoreSubmission, type Score } from '../../src/shared/scores';

type ScoreRow = {
  nickname: string;
  survival_ms: number;
  created_at: string;
};

type D1Result<T> = {
  results?: T[];
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all(): Promise<D1Result<ScoreRow>>;
  run(): Promise<unknown>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type ScoresEnv = {
  DB: D1Database;
};

type PagesFunctionContext = {
  request: Request;
  env: ScoresEnv;
};

const jsonHeaders = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
};

function isScorePayload(payload: unknown): payload is { nickname: unknown; survivalMs: unknown } {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload);
}

async function readTopScores(env: ScoresEnv): Promise<Score[]> {
  const result = await env.DB.prepare(
    `SELECT nickname, survival_ms, created_at
     FROM (
       SELECT
         nickname,
         survival_ms,
         created_at,
         ROW_NUMBER() OVER (
           PARTITION BY nickname
           ORDER BY survival_ms DESC, created_at ASC
         ) AS nickname_rank
       FROM scores
     ) ranked_scores
     WHERE nickname_rank = 1
     ORDER BY survival_ms DESC, created_at ASC
     LIMIT 10`,
  ).all();

  return (result.results ?? []).map((row) => ({
    nickname: row.nickname,
    survivalMs: row.survival_ms,
    createdAt: row.created_at,
  }));
}

async function readNicknameBest(
  env: ScoresEnv,
  nickname: string,
): Promise<ScoreRow | undefined> {
  const result = await env.DB.prepare(
    `SELECT nickname, survival_ms, created_at
     FROM scores
     WHERE nickname = ?
     ORDER BY survival_ms DESC, created_at ASC
     LIMIT 1`,
  )
    .bind(nickname)
    .all();

  return result.results?.[0];
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init?.headers,
    },
  });
}

export async function onRequestGet(context: PagesFunctionContext): Promise<Response> {
  try {
    const scores = await readTopScores(context.env);
    return jsonResponse({ scores });
  } catch {
    return jsonResponse({ error: 'Leaderboard request failed.' }, { status: 500 });
  }
}

export async function onRequestPost(context: PagesFunctionContext): Promise<Response> {
  let payload: unknown;

  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!isScorePayload(payload)) {
    return jsonResponse({ error: 'Invalid score payload' }, { status: 400 });
  }

  const validation = validateScoreSubmission(payload);
  if (!validation.ok) {
    return jsonResponse({ error: validation.message }, { status: 400 });
  }

  try {
    const currentBest = await readNicknameBest(context.env, validation.nickname);

    if (currentBest !== undefined && currentBest.survival_ms >= validation.survivalMs) {
      const scores = await readTopScores(context.env);
      return jsonResponse({ scores });
    }

    if (currentBest !== undefined) {
      await context.env.DB.prepare('DELETE FROM scores WHERE nickname = ?')
        .bind(validation.nickname)
        .run();
    }

    await context.env.DB.prepare('INSERT INTO scores (nickname, survival_ms) VALUES (?, ?)')
      .bind(validation.nickname, validation.survivalMs)
      .run();

    const scores = await readTopScores(context.env);
    return jsonResponse({ scores });
  } catch {
    return jsonResponse({ error: 'Leaderboard request failed.' }, { status: 500 });
  }
}
