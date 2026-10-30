# Calendar & Weather WhatsApp Bot — Implementation Plan

Implementation plan for [specs/calendar-weather-whatsapp-bot.md](calendar-weather-whatsapp-bot.md). Builds a Node.js/TypeScript service that proactively messages the user over WhatsApp (meeting reminders, a conditional weather digest) and lets them modify their Google Calendar conversationally.

## Context

Carried from the PRD: single-user, two-way WhatsApp bot (via Twilio) on the user's own Dockerized VPS. Proactive messages (15-min meeting reminders, 8am digest with conditional weather) are deterministic/cron-driven; reactive messages (e.g. "move my meeting to 3:30pm") are handled by an OpenAI tool-calling agent that asks for clarification rather than guessing. Google Calendar is called directly (no abstraction layer), weather comes from Open-Meteo, and secrets live in `.env` with the Google OAuth refresh token persisted to a mounted volume.

**Stack** (gathered during planning — project had no existing code to infer from; each choice made independently, not as a bundled preset):
- Runtime: **Node.js 22 + TypeScript**
- Web framework (Twilio webhook): **Express**
- Scheduling: **node-cron**
- Package manager: **npm**
- Test runner: **vitest**
- **Workflow: incremental TDD** — for each small piece of behavior, write a failing test first, implement just enough to make it pass, refactor, then move to the next piece. Milestones below are built up function-by-function this way, not implemented first and tested afterward.
- **Deployment target**: nginx runs directly on the VPS host (apt-installed, not Dockerized) and already terminates TLS via certbot for the user's other apps, via hand-maintained vhost configs. This bot is **not** directly internet-facing: its container publishes its webhook port bound to `127.0.0.1` only, and reaching it from the public internet depends on a new nginx server block (added manually on the host, outside this repo) proxying a subdomain to that localhost port.
- **Docker Compose from Milestone 1 onward** (not deferred to the deploy milestone) — `docker-compose.yml` exists from the first containerized milestone so the same `docker compose up` command works throughout, rather than switching from a bare `Dockerfile` later.
- **Dev vs. production running**: development runs natively (`npm run dev`, no auxiliary services needed — this project has no database to run alongside it); production runs entirely from `docker-compose.yml` (`docker compose up -d --build`). Documented in `README.md`.

## Milestones

Each milestone below is built TDD-style: pick the next function/behavior it needs, write a failing `vitest` test for it, implement just enough to pass, refactor, repeat until the milestone's file list is complete — then do the milestone's end-to-end check before moving on.

### 1. [x] Project scaffolding

Delivers a running, empty Express app with config loading, Docker packaging, and nothing integration-specific yet.

- `package.json`, `tsconfig.json`, `env.example` (named without the leading dot — `.env.example` is blocked by a local permission deny-rule on `.env*` files), `.gitignore`, `Dockerfile`, `docker-compose.yml` (added after Milestone 1 was first built, once the user flagged a Compose preference — see Stack above), `README.md` (intro, getting started, development vs. production running instructions)
- `src/config.ts` — loads and validates required env vars (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `TWILIO_ALLOWED_FROM`, `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) — `config.test.ts` first: test that it throws on a missing required var and returns a typed config object when all are present, then implement.
- `src/facts.ts` — static facts config (`home`, `office`, `karate`, etc.) per the PRD's facts decision — test that it loads and shapes the facts object, then implement.
- `src/server.ts` — bare Express app, listens on a port, no routes yet

**Verify**: `npm install && npm run build && npm test` all succeed; `npm start` boots and logs "listening".

### 2. [ ] WhatsApp webhook + access control

Delivers an inbound Twilio webhook that validates the sender against the allowlist and can send outbound messages. No agent or calendar logic yet — just the message pipe.

- `src/middleware/allowlist.ts` — test first: given a request from an allowed vs. disallowed sender, assert it calls `next()` vs. rejects; then implement the check against `TWILIO_ALLOWED_FROM`.
- `src/whatsapp/client.ts` — Twilio SDK wrapper (`sendMessage`, `sendTemplate`) — test with a mocked Twilio client that each method calls the SDK with the right arguments, then implement.
- `src/routes/webhook.ts` — `POST /webhook/whatsapp`, validates Twilio's request signature, wires in the allowlist middleware — test signature validation (valid/invalid) before implementing the route.

Depends on Milestone 1 (`config.ts`, `server.ts`).

**Verify**: send a simulated webhook POST (Twilio CLI or curl) with an allowed and a disallowed sender number; confirm the allowed one reaches a stub handler and the disallowed one is silently dropped and logged.

### 3. [ ] Google Calendar integration

Delivers real read/write access to the user's calendar.

- `src/calendar/client.ts` — `getEvents(range)`, `moveEvent(eventId, newStart)`, `findOfficeMarkerEvent(date)` — test each function against a mocked Google Calendar API client first (e.g. does `findOfficeMarkerEvent` correctly match/ignore events by title), then implement against the real `googleapis` client.
- `src/calendar/googleAuth.ts` — OAuth2 flow; refresh token persisted to `./data/google-token.json` (mounted as a Docker volume per the PRD's secrets decision) — test the token read/write/refresh logic against a temp file before wiring in the real OAuth2 client.
- `src/calendar/authorize.ts` — one-time local script to run the initial OAuth consent flow and mint the refresh token (this is a personal single-user bot, so no web-based consent UI is needed; not unit-tested, it's a manual-run script)

Depends on Milestone 1.

**Verify**: run `authorize.ts` against a real (or test) Google account, then call `getEvents()` for today and confirm it returns real calendar data.

### 4. [ ] Weather integration

Delivers the conditional rain-check rule, independent of everything else so it's the cleanest TDD target in the project.

- `src/weather/rules.ts` — `isNotableRain(forecast, commuteWindows, threshold)` — write the threshold/boundary tests first (just above/below 50%, inside/outside commute windows), then implement the rule against them.
- `src/weather/client.ts` — fetches an Open-Meteo forecast for a given lat/long — test against a mocked HTTP response shaped like Open-Meteo's API, then implement the real fetch.

No dependency on other milestones.

**Verify**: `npm test` — the rule's boundary tests from above, now green, double as the milestone's verification.

### 5. [ ] Proactive scheduler

Delivers the two deterministic cron jobs that are half the product.

- `src/scheduler/reminders.ts` — cron job checking for events starting in ~15 minutes, sends a WhatsApp reminder — test the "which events are within the reminder window" logic against fixed clock/event fixtures first, then implement the cron wiring.
- `src/scheduler/digest.ts` — cron job at 8am Europe/London, builds today's schedule and appends the weather line only when both the office marker (Milestone 3) and the rain rule (Milestone 4) fire — test the message-composition logic (with/without the weather line) against fixtures first, then implement.
- `src/scheduler/index.ts` — registers both jobs on startup (not unit-tested; wiring only)

Depends on Milestones 2 (send), 3 (calendar), 4 (weather).

**Verify**: temporarily point a cron schedule at "next minute" against a test calendar with a known event and an "In Office" marker; confirm a real WhatsApp message arrives with correct content, and that it's silent when the office marker or the rain threshold isn't met.

### 6. [ ] Reactive agent

Delivers the two-way conversational half: natural-language requests that read/write the calendar.

- `src/agent/memory.ts` — per-sender short-term conversation history (in-memory TTL map, ~30 min idle expiry per the PRD) — test insertion, retrieval, and expiry with a fake clock first, then implement.
- `src/agent/tools.ts` — tool definitions (`getEvents`, `moveEvent`, `getWeather`), shaped with name/description/JSON-schema input per the PRD's MCP-swappable-later decision — test each tool's schema validates expected inputs and calls the right underlying client function, then implement.
- `src/agent/facts.ts` — injects `src/facts.ts` into the agent's system prompt — test the prompt-building function's output shape, then implement.
- `src/agent/openaiClient.ts` — the tool-calling loop against OpenAI — test the loop's control flow against a mocked OpenAI client (tool call → tool result → final reply), then implement against the real SDK.
- Wire into `src/routes/webhook.ts`: an allowed, inbound message is handed to the agent, and its reply is sent back via `src/whatsapp/client.ts`

Depends on Milestones 2, 3, 4.

**Verify**: send real WhatsApp messages against a test calendar with two same-day meetings — confirm an unambiguous move succeeds, confirm an ambiguous one triggers a clarifying question, and confirm a follow-up reply ("the one with Bob") resolves correctly using the conversation memory.

### 7. [ ] Resilience & deploy

Delivers the failure-handling policy and finalized container packaging.

- `src/lib/retry.ts` — shared retry-with-backoff helper, used by the calendar, weather, and WhatsApp clients — test it retries N times then gives up, and succeeds immediately on a passing call, using a fake failing/succeeding function, then implement.
- `docker-compose.yml` extended (already exists from Milestone 1) — adds the `./data` volume mount for the persisted Google refresh token; port binding to `127.0.0.1` only was already set up in Milestone 1.
- `Dockerfile` finalized (build/runtime image for the app)
- **Manual host-level step (not a file in this repo)**: add an nginx server block on the VPS proxying the bot's chosen subdomain to `127.0.0.1:<port>`, and obtain a cert for it via certbot, matching the pattern already used for the user's other apps on this VPS.

Depends on all prior milestones (wraps their clients).

**Verify**: deliberately break one dependency (e.g. an invalid API key) and confirm the retry-then-log behavior shows up in `docker logs`, with no crash loop. Separately, confirm the nginx vhost + certbot cert are in place by hitting the public subdomain over HTTPS and seeing the request reach the container.

## Open questions carried forward

- **Meta Business verification / WhatsApp template approval** has unknown lead time and blocks Milestone 5's proactive messages going live in production (not blocking development against the webhook itself). Start this in parallel with Milestone 1, not after Milestone 6.
- **Google OAuth refresh tokens expire after 7 days in "testing" mode** unless the app is published or the user is added as a test user — check this while building Milestone 3 so calendar access doesn't silently break a week in.
- **LLM tool-calling reliability on write operations**: Milestone 6's `moveEvent` tool is the single highest-consequence failure mode in the whole project (per the PRD) — worth extra defensive validation (e.g. confirming the resolved event ID/time back to the user before calling it) beyond what's specified here.

## Out of scope

Per the PRD's Non-goals — not part of any milestone above: multi-user support; data sources beyond calendar + weather; migrating off Google Calendar; a self-hosted/local LLM; the official Met Office warnings feed; generalizing proactive weather checks to other tagged locations; Signal or Telegram as messaging channels; MCP-based tools (hand-written tools are shaped to allow this later, but no MCP server is built now).
