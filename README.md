# Calendar & Weather WhatsApp Bot

A personal WhatsApp bot that proactively reminds you of upcoming meetings and notable weather, and lets you manage your Google Calendar conversationally (e.g. "move my meeting to 3:30pm"). See [specs/calendar-weather-whatsapp-bot.md](specs/calendar-weather-whatsapp-bot.md) for the full design and [specs/calendar-weather-whatsapp-bot-plan.md](specs/calendar-weather-whatsapp-bot-plan.md) for build progress.

## Getting started

Prerequisites: Node 22+, npm. Docker and Docker Compose are needed for production only.

```bash
npm install
cp env.example .env
```

Fill in `.env` with real values — see [env.example](env.example) for the required variables (Twilio, OpenAI, Google OAuth credentials).

## Development

Run the app natively, with live reload on change:

```bash
npm run dev
```

Other useful commands:

```bash
npm test        # run the vitest suite
npm run build   # type-check and compile to dist/
```

This project has no auxiliary services (no database, etc.) to run alongside it in development — `npm run dev` is all you need.

## Production

Everything builds and runs from the single `docker-compose.yml`:

```bash
docker compose up -d --build
```

The container publishes its webhook port bound to `127.0.0.1` only — it is not directly internet-facing. Reaching it from the public internet depends on a manually configured nginx server block + certbot certificate on the host (see the plan's Milestone 7 for details) — this is a one-time, outside-this-repo setup step, not something `docker compose` handles.
