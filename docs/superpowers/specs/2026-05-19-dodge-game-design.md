# Dodge Game Design

Date: 2026-05-19

## Summary

Build a browser-based space dodge game inspired by classic bullet-avoidance arcade games. The player controls a small spaceship with arrow keys, avoids bullets converging from all sides, and tries to survive as long as possible. The game will be deployed from GitHub `nj0034/dodge` to Cloudflare Pages. Cloudflare's free plan is a design constraint.

## Goals

- Create a playable web game with responsive keyboard control and a clear survival loop.
- Use a hybrid visual direction: retro rules and dense bullets with a polished modern web presentation.
- Keep the background stars dim and soft so bullets are always visually distinct.
- Increase difficulty over time through continuous scaling and timed pattern unlocks.
- Include online leaderboard submission with nickname entry after game over.
- Keep the Cloudflare backend minimal and free-plan friendly.
- Prepare the project for GitHub push and Cloudflare Pages deployment.

## Non-Goals

- Mobile touch controls are not part of the first version.
- Multiplayer, accounts, authentication, and anti-cheat systems are out of scope.
- A full game engine such as Phaser is not required for the first version.
- The game should not make server calls during active gameplay.

## Visual Direction

The game uses a dark space background with dim gray-blue stars. Stars should be blurred, low-contrast, and visually secondary. Bullets use saturated colors, stronger glow, and larger silhouettes so they remain readable during dense patterns.

The ship is small and centered around precise movement. HUD text uses a compact arcade style and stays out of the play area as much as possible. The first viewport is the game itself, not a landing page.

## Gameplay

- The player moves a spaceship using arrow keys.
- Survival time is the score.
- Bullets spawn from the screen edges and move inward toward the play area or player.
- The player starts with one shield charge.
- The first hit consumes the shield.
- The next hit ends the run.
- The game-over screen shows survival time, personal best, nickname input, score submission, and leaderboard.

## Difficulty Model

Difficulty combines continuous pressure with timed pattern unlocks.

| Time | Unlock | Scaling |
| --- | --- | --- |
| 0s | Basic edge bullets moving toward the player's current position | Low spawn rate, low speed, generous early spacing |
| 20s | Heavy bullets | Spawn interval shortens and speed rises |
| 40s | Warning-line dash bullets | Short warning cue, then a fast cross-screen strike |
| 60s | Spiral or rotating edge bursts | More pattern mixing and fewer quiet moments |
| 90s+ | Rare split bullets | Higher density, with caps to avoid impossible states |

The game should feel dangerous but readable. Special bullets must have either readable size, slower movement, or warning cues. Bullet density and speed should have caps so deaths feel avoidable rather than random.

## Technical Approach

Use Vite, TypeScript, and Canvas. React is intentionally excluded because the game loop and rendering are Canvas-first, while menus can be handled with lightweight DOM overlays.

Core frontend modules:

- `main`: bootstraps the app and switches between menu, playing, and game-over states.
- `gameLoop`: runs `requestAnimationFrame`, clamps delta time, updates state, and triggers rendering.
- `input`: tracks arrow-key state.
- `player`: handles movement, bounds, shield state, and collision radius.
- `bullets`: owns bullet entities, pattern spawning, movement, and cleanup.
- `difficulty`: derives spawn rates, speed multipliers, and unlocked patterns from elapsed time.
- `collision`: checks player-vs-bullet hits using circle collision.
- `renderer`: draws background, bullets, ship, shield, particles, and HUD.
- `leaderboardClient`: calls Cloudflare Functions for score reads and writes.
- `ui`: manages start screen, restart controls, game-over modal, local best, submit state, and error messages.

## Leaderboard Backend

Use Cloudflare Pages Functions with Cloudflare D1.

Routes:

- `GET /api/scores`: returns the top 10 scores sorted by `survival_ms` descending.
- `POST /api/scores`: accepts nickname and survival time after game over, validates input, inserts one row, and returns the updated top scores or the inserted score.

D1 table:

```sql
CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  survival_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scores_survival_ms ON scores (survival_ms DESC);
```

Validation:

- Nickname is required, trimmed, and limited to 16 visible characters.
- Survival time must be a positive integer.
- Survival time is capped at 3,600,000 ms to reject obviously invalid submissions.
- API responses should not block local gameplay.

## Cloudflare Free-Plan Constraints

The frontend is static and should account for almost all traffic. API calls are limited to leaderboard reads on menu/game-over screens and one score submission after a run.

If leaderboard requests fail or quota is exceeded:

- The game still starts and plays normally.
- The UI shows a small non-blocking message.
- Personal best remains available through `localStorage`.

Use D1 instead of KV for leaderboard storage because D1 is better suited for sorted score queries and has a more appropriate free-tier write/read profile for this use case.

## Deployment

Create and push a GitHub repository under `nj0034/dodge`. The repository should be ready for Cloudflare Pages.

Cloudflare Pages configuration:

- Build command: `npm run build`
- Output directory: `dist`
- Functions directory: `functions`
- D1 binding name: `DB`

Cloudflare setup will be documented for manual dashboard connection:

- Connect GitHub repo to Pages.
- Create or attach a D1 database.
- Apply the D1 migration.
- Configure the `DB` binding for Pages Functions.
- Deploy from the `main` branch.

## Testing And Verification

Unit or module tests should cover:

- Difficulty thresholds and scaling.
- Bullet spawning and movement.
- Collision behavior, including shield consumption before game over.
- Score validation for the Pages Function.

Browser verification should cover:

- Start game.
- Move with arrow keys.
- Confirm bullets spawn and remain distinguishable from the star field.
- Confirm shield absorbs first hit.
- Confirm second hit triggers game over.
- Submit a nickname and score when API is available.
- Confirm graceful fallback when leaderboard requests fail.

Build verification:

- TypeScript checks pass.
- Tests pass.
- Vite build succeeds.
- Cloudflare Pages output is produced in `dist`.

## Open Decisions Resolved

- Visual direction: hybrid.
- Controls: arrow keys only for the first version.
- Leaderboard: nickname entry after game over.
- Backend: Cloudflare Pages Functions plus D1.
- Deployment: Codex creates and pushes the GitHub repo; Cloudflare Pages connection is documented for manual setup.
