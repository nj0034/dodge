# Dodge

Arrow-key space dodge game built with Vite, TypeScript, Canvas, Cloudflare Pages Functions, and Cloudflare D1.

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

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Functions directory: `functions`
- D1 binding: `DB`

See `docs/deployment/cloudflare-pages.md` for the setup steps.
