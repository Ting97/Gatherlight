**English** | [中文](./README.zh-CN.md)

# Gatherlight (叙间拾光)

> **Your life, your data, your AI** — a self-hosted life assistant powered by NVIDIA Nemotron on Nebius Token Factory.

**Live demo: <https://gatherlight.ting97.cn>** (English UI by default; switch to Chinese anytime from the header)

| Account | Credentials | Purpose |
|---|---|---|
| Demo user | `en-demo@ting97.cn` / `en-demo-2026` | Pre-seeded with six domains of English demo data — start here |
| Admin | `admin@ting97.cn` / `admin1234` | Admin console: prompt hot-reload, AI audit log, quotas, module switches |

Open registration is also enabled — sign up with any email address, no invite code required.

This repository is our entry for the [Nebius x NVIDIA Global AI Hackathon 2026](https://nebiusglobalaihackathon.devpost.com/) (Personal AI track).

## What it is

Gatherlight is a **self-hosted personal life OS**. Type one casual sentence into the moment feed — *"Morning run 40 minutes, feeling great, lunch with Emma cost 260"* — and the AI extracts 🕒 schedule blocks, 📋 todos, 💰 transactions, 😊 mood and 🍽 meals into the right modules. Low-confidence extractions land in a **pending-confirmation** area: nothing is recorded until a human approves it.

Six domain AI assistants (global / goals / time / people / finance / fitness) answer questions **from your own structured data** through read-only query tools. When an assistant wants to change something, it files a proposal card that you approve — the AI never writes business data directly.

All data stays in your own PostgreSQL database. The UI is bilingual (English / 中文) and every AI output follows the interface language.

## How it uses Nebius & NVIDIA

- All runtime LLM calls go to **Nebius Token Factory** (`https://api.tokenfactory.nebius.com/v1`), an OpenAI-compatible endpoint
- Model: **`nvidia/Nemotron-3_5-Lightning`** (NVIDIA open model, 30B MoE — the most cost-efficient Nemotron on Token Factory) — used for domain assistants, moment extraction, periodic reviews and goal decomposition
- Function calling over the standard OpenAI tools protocol: 20 read-only query tools (`query_transactions`, `query_calendar`, `query_contacts`, …) plus confirmable proposal tools
- The model layer is endpoint-agnostic: point `ZHIPUAI_BASE_URL` at any OpenAI-compatible service (e.g. Zhipu GLM) — zero code change
- Nemotron-3 is a thinking model; for latency-sensitive tasks we disable thinking via `reasoning_effort: "none"` and fall back to its `reasoning` field (`packages/ai/src/glm.ts`)

```env
ZHIPUAI_BASE_URL=https://api.tokenfactory.nebius.com/v1
ZHIPUAI_API_KEY=<your Nebius Token Factory key>
GLM_MODEL=nvidia/Nemotron-3_5-Lightning
```

## Core features

- **One sentence, five domains** — record moments in the feed (text, or voice when an ASR-capable endpoint is configured); the AI extracts them into 🕒 schedule blocks, 📋 todos, 💰 transactions, 😊 mood and 🍽 meals. Low-confidence items wait in "pending confirmation" and only enter the books after a human approves
- **Time & todos** — day/week/month/year calendar views, conflict detection, today's action list, subtask breakdown and daily repeats
- **Goal spaces** — a dedicated space for each big goal (pass the exam, launch a side business…), aggregating its actions, reflections and moments with progress cards
- **People graph** — a draggable orbit map centered on you; contact profiles with solar/lunar birthdays, anniversaries and a gift-exchange ledger
- **Finance & budgeting** — multi-account bookkeeping, category stats, monthly budgets with alerts, Alipay/WeChat Pay CSV import, AI weekly finance review
- **Fitness & sleep** — training plans and logs, daily sleep tracking with feel/score, sync via the Xunji (SynFit) Open API
- **Domain AI assistants** — six assistants (global/goal/time/people/finance/fitness) with 20 read-only query tools + proposal confirmation cards (the AI never writes business data directly; proposals take effect only after you approve)
- **Module switches** — modules can be toggled per user; the admin console supports prompt hot-reload, AI audit and quotas
- **Data ownership** — self-hosted accounts (email + password, open registration), data export (JSON / Markdown), sign out everywhere

## Tech stack

- **Frontend**: Next.js 15 (App Router, static export)
- **Server**: Next.js standalone hosting the API and static assets (`src/server/<domain>`, nine domains)
- **AI core**: standalone pure package `packages/ai` — zod contracts + OpenAI-compatible model access + a rule-engine fallback; tool calling over the standard OpenAI tools protocol
- **Database**: PostgreSQL (hand-written SQL migrations + runner, `packages/db`)
- **Engineering**: npm workspaces monorepo, TypeScript strict, node:test, GitHub Actions CI

## Quick start

Requirements: Node ≥ 20, PostgreSQL 13+.

```bash
npm install                       # install dependencies
cp .env.example .env              # configure environment variables (see below)
npm run db:migrate -- --fresh     # create tables on a new database (⚠️ wipes the target DB)
npm run dev                       # local development (web)
npm run dev:api                   # local development (api)
```

Production build and run:

```bash
npm run build
set -a && source .env && set +a && PORT=3100 node apps/api/.next/standalone/apps/api/server.js
```

Key environment variables (see `.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `ZHIPUAI_API_KEY` | API key for the OpenAI-compatible model endpoint (required for AI features) |
| `SETUP_TOKEN` | one-time bootstrap token: the first admin is created via `POST /api/auth/setup` (sent in the `x-setup-token` header), after which the token is invalidated |
| `EMAIL_SMTP_*` | SMTP channel for email verification codes (if unset, registration skips the code) |
| `AUTH_DISABLED` | local development only; a non-empty value in production refuses to start |

**Create the first admin** — after the service starts, call setup with your `SETUP_TOKEN`:

```bash
curl -X POST http://127.0.0.1:3100/api/auth/setup \
  -H "content-type: application/json" -H "x-setup-token: <your SETUP_TOKEN>" \
  -d '{"nickname":"admin","email":"admin@example.com","password":"your-password"}'
```

After that, anyone can register at `/login` with an email — registration is open and needs no invite code (the system auto-generates an invite-code record per user for auditability).

**Demo data**: the scripts under `scripts/qa/` seed every module with demo data against any environment:

```bash
BASE_URL=https://your-host SEED_EMAIL=you@example.com SEED_PASSWORD=xxx node scripts/qa/seed-demo-en.mjs
```

## Repository layout

```
apps/
  web/        # frontend (Next.js static export)
  api/        # server (API + static hosting, nine domains under src/server)
packages/
  ai/         # AI core, pure package (contracts / prompts / model access / rule fallback)
  shared/     # cross-end types & pure functions (dates / lunar calendar / CSV / graph / API client)
  db/         # schema.sql + SQL migrations + runner
  design-tokens/ # design token sources & generator
scripts/qa/   # demo data seed scripts
```

## Hackathon timeline

| Milestone | Time |
|---|---|
| Submission deadline | 2026-10-30 10:00 AM PT (Oct 31, 01:00 Beijing time) |
| Judging period | 2026-12-01 – 12-15 (demo must stay alive) |
| Winners announced | ~2027-01-11 |

## License

[Apache-2.0](./LICENSE)
