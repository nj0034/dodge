# Cloudflare Pages Deployment

This project is designed for the Cloudflare free plan. The game is static during active play. The only server calls are leaderboard reads and one score submission after game over.

## 1. Create D1 Database

```bash
npx wrangler login
npx wrangler d1 create dodge-scores
```

Keep the returned database UUID available for local `wrangler pages dev` runs.

## 2. Apply Migration

```bash
npx wrangler d1 migrations apply dodge-scores --remote
```

## 3. Connect Pages

1. Open Cloudflare dashboard.
2. Go to Workers & Pages.
3. Create a Pages project from GitHub.
4. Select `nj0034/dodge`.
5. Use build command `npm run build`.
6. Use output directory `dist`.
7. Deploy from `main`.

## 4. Confirm D1 Binding

If the Pages project does not pick up `wrangler.toml`, add a dashboard binding:

- Variable name: `DB`
- Type: D1 database
- Database: `dodge-scores`

Redeploy after changing bindings.

## 5. Local Pages Function Check

Set `DATABASE_ID` to the UUID returned by `npx wrangler d1 create dodge-scores`, then run:

```bash
npm run build
npx wrangler pages dev dist --d1 DB="$DATABASE_ID"
```

## 6. Verify

- Open the deployed Pages URL.
- Start a game.
- End a run.
- Submit a nickname.
- Confirm the submitted score appears in the leaderboard.
