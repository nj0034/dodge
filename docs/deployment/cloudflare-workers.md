# Cloudflare Workers Deployment

This project is designed for the Cloudflare free plan. The game is static during active play. The only server calls are leaderboard reads and one score submission after game over.

## 1. Create D1 Database

```bash
npx wrangler login
npx wrangler d1 create dodge-scores --location apac
```

Keep the returned database UUID in `wrangler.toml` under the `DB` D1 binding.

## 2. Apply Migration

```bash
npx wrangler d1 migrations apply dodge-scores --remote
```

## 3. Connect Worker Builds

1. Open Cloudflare dashboard.
2. Go to Workers & Pages.
3. Open the `dodge` Worker.
4. Go to Settings > Build and connect `nj0034/dodge`.
5. Use build command `npm run build`.
6. Use deploy command `npx wrangler deploy`.
7. Use non-production deploy command `npx wrangler versions upload`.
8. Use root directory `/` or leave it empty. Do not set this to `dist`.
9. Deploy from `main`.

## 4. Confirm D1 Binding

The Worker reads this binding from `wrangler.toml`:

- Variable name: `DB`
- Type: D1 database
- Database: `dodge-scores`

The Worker also uses Workers Static Assets:

- Asset binding: `ASSETS`
- Asset directory: `dist`
- API route: `/api/scores`

Redeploy after changing bindings or build settings.

## 5. Local Worker Check

```bash
npm run build
npx wrangler deploy --dry-run
```

## 6. Verify

- Open the deployed Worker URL.
- Confirm `/api/scores` returns JSON.
- Start a game.
- End a run.
- Submit a nickname.
- Confirm the submitted score appears in the leaderboard.
