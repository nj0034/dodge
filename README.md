# Dodge

Arrow-key space dodge game built with Vite, TypeScript, Canvas, Cloudflare Workers Static Assets, and Cloudflare D1.

Controls:

- Arrow keys move the ship.
- Space starts, pauses, resumes, and restarts the game.

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
npm run e2e
```

## Cloudflare Workers

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root
- Static assets directory: `dist`
- D1 binding: `DB`

See `docs/deployment/cloudflare-workers.md` for the setup steps.
