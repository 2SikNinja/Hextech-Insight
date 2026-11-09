# Hextech Insight

[![CI](https://github.com/2SikNinja/Hextech-Insight/actions/workflows/ci.yml/badge.svg)](https://github.com/2SikNinja/Hextech-Insight/actions/workflows/ci.yml)

Live at **[hextech-insight.vercel.app](https://hextech-insight.vercel.app)**

League of Legends match history and player analytics. Search any player by Riot ID to see their rank, recent games with full builds, and a breakdown of how they play each champion and role.

## Features

- **Search by Riot ID** (`Name#TAG`) across every League region, with shareable player URLs like `/summoner/na/Name-TAG`
- **Search suggestions** after 3 letters, from every player the site has seen (Riot's API has no name search, so the list grows as more matches are stored)
- **Rank** for Ranked Solo/Duo and Ranked Flex
- **Match history** with champion, spells, runes, KDA, CS, kill participation, items and the full lobby, filterable by queue
- **Match details** for all ten players: damage, gold, CS, vision, items, objectives and bans
- **Performance stats** computed in Python: win rate, KDA, per-minute stats, recent form, streaks, and champion and role breakdowns
- **Insights tab** computed in Python:
  - **Trends:** KDA, CS, damage, gold and vision per game with a 5-game rolling average, and how recent games compare with earlier ones
  - **Early game:** gold, CS and XP difference against the lane opponent at 10 and 15 minutes, from Match-V5 timelines
  - **Lane matchups:** record and gold difference against each opponent champion
  - **By patch, time of day and session:** results per game version, per part of the day (in the viewer's timezone) and by how many games into a play session
  - **Played with:** frequent teammates and the record together
- **Champion mastery** and a **live game** check (Spectator-V5) on every profile
- **Load older games** to extend history and stats beyond the latest 20
- **Compare** two players side by side
- **Link previews:** generated Open Graph images show rank and win rate when a profile is shared
- **Favorites** saved in the browser, no account needed

## How it works

```
Browser ──> Next.js (TypeScript) ──> Riot API        (only for data we have not stored yet)
                    │
                    ├──> Supabase (Postgres)  <── cache of players and matches
                    │
                    └──> /api/py ──> FastAPI (Python) ──> Supabase   (analytics, read only)
```

- **Next.js** renders every page and is the only part that talks to Riot. The Riot API key stays on the server and is sent as a header, so it never reaches the browser.
- **Supabase** caches players and finished matches. A match never changes, so each one is downloaded from Riot once. Repeat visits cost zero Riot calls.
- **FastAPI** (`api/index.py`, `api/_insights.py`) reads stored matches and computes the stats panel and the Insights tab. It never calls Riot, so it cannot use up the rate limit.
- **Timelines** for early-game stats are downloaded in the background after a page is sent (`after()`), so they never slow a page down.
- **Data Dragon**, Riot's CDN, serves every champion, item, spell, rune and profile image. The latest patch is picked up automatically.

### Protecting the API key

Every action that calls Riot first reserves an estimated number of requests through a Postgres function (`reserve_riot_budget`), which enforces two limits atomically:

- a **site-wide budget** of 90 requests per 2 minutes, under the personal key's limit of 100
- a **per-visitor limit** on expensive actions (new lookups, updates, loading older games), keyed by a salted hash of the IP address so no IP is stored

On top of that, only matches that are not already stored are fetched, short 429 waits are retried once, and each player can be updated at most once every two minutes.

## Tech stack

| Part | Tools |
| --- | --- |
| Front end | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4 |
| Analytics | Python, FastAPI, Pydantic |
| Database | Supabase (PostgreSQL) |
| Validation | Zod for every Riot API response |
| Testing | Vitest and pytest, run on every push by GitHub Actions |
| Hosting | Vercel (Next.js and the Python function in one project) |

## Running locally

Requirements: Node.js 20.19 or newer (22 LTS recommended) and Python 3.10 or newer. Older Node versions fail to build Tailwind CSS with a "require() of ES Module" error.

1. **Install dependencies**

   ```bash
   npm install
   npm run setup:python
   ```

2. **Create the database.** Make a free project at [supabase.com](https://supabase.com), open **SQL Editor**, paste in `supabase/schema.sql` and run it. (A database created before the features update only needs `supabase/migrations/002_features.sql`.)

3. **Add your keys**

   ```bash
   cp .env.example .env.local      # PowerShell: Copy-Item .env.example .env.local
   ```

   Fill in `RIOT_API_KEY` from the [Riot Developer Portal](https://developer.riotgames.com) and `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from your Supabase project (**Project Settings > API**).

4. **Start both servers**

   ```bash
   npm run dev
   ```

   Riot encrypts player IDs per API key, so if your local copy shares a database with the live site, use the same Riot key in both (or give local development its own Supabase project).

   Next.js runs on http://localhost:3000 and the Python service on port 8000. Requests to `/api/py/*` are forwarded to Python automatically.

On macOS or Linux, if `python` is not found, change `python` to `python3` in the `dev:python` and `setup:python` scripts in `package.json`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next.js and the Python service together |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | TypeScript unit tests (Vitest) |
| `npm run test:python` | Python analytics tests (pytest) |

## Deploying to Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js and builds `api/index.py` as a Python function.
2. Add `RIOT_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SITE_URL` under **Settings > Environment Variables**.
3. Deploy.

### About the Riot API key

Riot issues three kinds of keys:

- **Development key:** expires every 24 hours. Use it for local work.
- **Personal key:** does not expire, but is meant for you and a small group.
- **Production key:** required for a public site. Apply through the Developer Portal with a working prototype.

Riot's policies don't allow running a public product on a development key, so register the app and apply for a production key before sharing the site widely.

## Project structure

```
api/index.py              Python service: HTTP endpoints and Supabase queries (FastAPI)
api/_insights.py          Python insights: trends, laning, matchups, patches, schedule, teammates
src/app/                  Pages: home, summoner, match, compare, favorites, about
src/components/           UI components, including the hand-built SVG trend chart
src/lib/riot/             Riot API client, Zod schemas, regions, queue names, match and timeline transforms
src/lib/ddragon.ts        Data Dragon static data and image URLs
src/lib/summoners.ts      Cache-first player lookups, refresh and background timeline backfill
src/lib/matches.ts        Match ingestion (recent and older), timelines, history and details
src/lib/rateLimit.ts      Riot API budget and per-visitor limits
supabase/schema.sql       Full database schema for a new project
supabase/migrations/      Changes for existing databases
tests/                    Vitest and pytest suites
.github/workflows/ci.yml  Lint, typecheck, tests and build on every push
```

## Legal

Hextech Insight isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
