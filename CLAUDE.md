# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Schrollar (hackfest26-admulto) is a research paper discovery app that presents academic papers in a social-media-style scrollable feed. Users enter a research topic, the backend finds papers via Semantic Scholar API + SearXNG web search, generates AI syntheses via Ollama (Qwen3 8B), verifies claims with DeBERTa NLI, and displays results as cards with voting, comments, and polls.

## Commands

- `npm run dev` — Next.js dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint on src/
- `npm run deploy` — build + deploy to Cloudflare Workers via OpenNext
- `npm run preview` — build + local Cloudflare preview
- `npx prisma generate` — regenerate Prisma client after schema changes
- `npm run db:migrate:local` — apply D1 migrations locally
- `npm run db:migrate:remote` — apply D1 migrations to remote D1

## Architecture

### Stack
- **Next.js 16** (App Router, React 19) deployed to **Cloudflare Workers** via OpenNext
- **Prisma** with SQLite — two adapters: `PrismaLibSql` for local dev (`src/lib/db.ts`), `PrismaD1` for Cloudflare production (`src/lib/prisma.ts`)
- **Tailwind CSS v4** + **shadcn/ui** (base-nova style, `components.json`)
- **Ollama** (Qwen3 8B) for AI synthesis and citation generation (`src/lib/ollama.ts`)

### External Services (self-hosted via Docker, tunneled through Cloudflare)
- **SearXNG** (localhost:8888) — web search fallback when Semantic Scholar rate-limits
- **DeBERTa NLI** (localhost:8890) — fact-grounding verification of AI-generated card text
- **Ollama** (localhost:11434) — LLM inference
- Setup: `cd local-server && docker compose up -d --build`

### Key Data Flow
1. User submits topic at `/onboarding` → POST `/api/generate-feed`
2. Backend searches Semantic Scholar (with retry/rate-limit handling) + SearXNG fallback
3. Ollama generates synthesis per paper, DeBERTa verifies claims
4. Papers saved to DB as a "Scroll" → user redirected to `/scroll/[id]`

### Database
- Schema: `prisma/schema.prisma` — models: Scroll, Paper, Comment, Vote, Poll, PollResponse
- Local dev uses `prisma/dev.db` (SQLite via libsql adapter)
- Production uses Cloudflare D1 (configured in `wrangler.jsonc`)

### Route Structure
- `/` — home/landing
- `/onboarding` — topic input
- `/scroll/[id]` — main feed view for a scroll session
- `/scroll/[id]/post/[postId]` — individual paper detail
- `/api/generate-feed` — main feed generation endpoint
- `/api/scrolls`, `/api/comments`, `/api/votes`, `/api/poll-responses` — CRUD endpoints

### Environment Variables
Set in `.env.local`:
- `SEARXNG_URL` — SearXNG instance URL
- `DEBERTA_URL` — DeBERTa NLI service URL
- `OLLAMA_URL` — Ollama instance URL (defaults to http://localhost:11434)
- `SEMANTIC_SCHOLAR_API_KEY` — optional, for higher S2 rate limits
