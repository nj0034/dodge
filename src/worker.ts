import { onRequestGet, onRequestPost } from '../functions/api/scores';

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all(): Promise<{ results?: ScoreRow[] }>;
  run(): Promise<unknown>;
};

type ScoreRow = {
  nickname: string;
  survival_ms: number;
  created_at: string;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type WorkerEnv = {
  ASSETS: AssetsBinding;
  DB: D1Database;
};

const methodNotAllowed = () =>
  new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/scores') {
      if (request.method === 'GET') {
        return onRequestGet({ request, env });
      }

      if (request.method === 'POST') {
        return onRequestPost({ request, env });
      }

      return methodNotAllowed();
    }

    return env.ASSETS.fetch(request);
  },
};
