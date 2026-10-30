# Calendar & Weather WhatsApp Bot

A personal WhatsApp bot that proactively reminds the user of upcoming meetings and notable weather, and lets the user manage their calendar conversationally ("move my meeting to 3:30pm").

## Context

The user wants a single piece of software that pulls from other apps (calendar, weather) and pushes relevant information to them over WhatsApp, plus accepts WhatsApp replies that actually modify their calendar. It should run on infrastructure they already control (a Dockerized VPS), avoid introducing a new app into their daily routine, and avoid funding Meta directly where a reasonable alternative exists. It also doubles as a learning project for LLM tool-calling/agent patterns and, eventually, MCP.

## Goals

- Proactively message the user:
  - 15 minutes before each calendar meeting.
  - A daily 8am digest of the day's schedule, including a weather warning when it's actually worth mentioning.
- Let the user send natural-language WhatsApp messages that read and modify their Google Calendar (e.g. move, and later other operations), with the bot asking for clarification rather than guessing when a request is ambiguous.
- Run entirely on the user's own VPS, with secrets and OAuth tokens persisted safely across restarts.
- Keep ongoing cost low and spend hard-capped.

## Non-goals (deferred / out of scope)

- Multi-user support — this is single-user only.
- Data sources beyond Google Calendar and weather (e.g. email, tasks, smart home, transit) — may be added later as additional agent tools, following the same pattern.
- Migrating off Google Calendar to a self-hosted calendar or Solid Pods — planned by the user eventually, but v1 talks to the Google Calendar API directly with no abstraction layer.
- Self-hosted/local LLM (e.g. via Ollama) — may be reconsidered later for cost or privacy reasons; v1 uses a cloud LLM.
- Official Met Office severe-weather warning feed — v1 uses a generic precipitation forecast only.
- Generalizing proactive weather checks to other tagged locations/activities (e.g. a "karate" weather check) — handled reactively on demand instead of as another proactive trigger.
- Signal as a messaging channel — ruled out because it has no official bot API, only the unofficial, unsupported `signal-cli`.
- Telegram as a messaging channel — ruled out because it would require installing an app the user would use for nothing else.
- MCP-based tools — the agent's tools are hand-written for v1, but deliberately shaped (name, description, JSON-schema input) so they can be swapped for MCP servers later without a redesign.

## Decisions

- **Messaging channel: WhatsApp via Twilio (a BSP), not direct via Meta.**
  Keeps the user on an app they already use daily (no new app, unlike Telegram), avoids giving money directly to Meta, and — critically — gives prepaid-balance billing with a hard spending cap, which Meta's own direct Cloud API does not offer (that's postpaid against a card on file). Twilio's lack of a monthly platform fee also beats competitors (360dialog, MessageBird) at this message volume, despite Twilio's small per-message markup.
- **Twilio Sandbox is skipped in favor of a fully provisioned WhatsApp Sender.**
  Sandbox only supports 3 fixed generic templates for business-initiated messages and expires every 3 days — it cannot carry the custom proactive message content (reminders, digest) that is half of this app's purpose. The Sender needs a rented Twilio virtual number (not a physical second phone) and Meta Business verification, started early due to unknown approval lead time.
- **Access control: hardcoded allowlist of the user's WhatsApp sender number.** All other senders are ignored. This is a single-user bot with write access to a real calendar, so unauthenticated access is a real risk, not a theoretical one.
- **Hosting: Dockerized service on the user's existing VPS, receiving Twilio webhooks over HTTPS**, using the user's existing Let's Encrypt setup — chosen over long-polling for lower latency, consistent with infrastructure the user already runs.
- **Calendar integration: Google Calendar API called directly, no provider-abstraction interface.** The user's eventual migration target (self-hosted calendar / Solid Pods) isn't decided yet, so any abstraction written now would likely be the wrong one. Simpler to rewrite later once the real target is known.
- **Core architecture is split by responsibility, not unified into one agent loop:**
  - *Reactive* (user-initiated): an LLM agent (OpenAI, tool-calling) with hand-written tools (e.g. `getEvents`, `moveEvent`, `getWeather`). Handles ambiguity by asking the user to clarify over WhatsApp rather than guessing, using short-term conversation memory per chat (reset after ~30 minutes idle) so follow-up replies ("yes, that one") resolve correctly.
  - *Proactive* (bot-initiated): plain deterministic scheduling/cron logic, not an agentic loop deciding whether to act. An LLM deciding on a timer whether to message the user would be slower, costlier, and less predictable than a fixed rule; the agent/tool-calling complexity is reserved for where it earns its keep — parsing freeform write requests.
- **LLM provider: OpenAI**, using the user's existing credits. Revisit self-hosting later if cost or privacy tips the balance.
- **V1 data sources: Google Calendar + weather only.** Explicitly resisting scope creep ("etc.") until these two are working end-to-end.
- **Per-event reminder lead time: 15 minutes before each meeting.**
- **Morning digest time: 8am.**
- **Weather line in the digest is conditional, not a standing forecast**, to avoid the user tuning it out: it only appears when both (a) a dedicated "In Office" marker event exists on the calendar for that day, and (b) Open-Meteo forecasts >50% precipitation probability during commute windows (8–9am / 5–6pm). Checking only commute windows (not the whole day) targets the actual "will I get rained on getting to/from work" question an umbrella warning is for.
- **Office-day detection via a dedicated recurring marker event** (e.g. "In Office"), rather than inferring from event location fields — more reliable than depending on the user filling in a location on every meeting.
- **Weather API: Open-Meteo** — free, open data, no API key, fits the user's preference for open-source/free tooling.
- **User "facts" (e.g. `home: Edinburgh`, `office: Glasgow`, `karate: Stirling`) are static config fed into the reactive agent's context** for on-demand reasoning (e.g. "do I need an umbrella for karate tonight?"), but do **not** feed into or expand the proactive trigger logic, which stays scoped to the one office-day rule above.
- **Secrets stored in a `.env` file**, appropriate for a single-container personal project over a dedicated secrets manager. The Google OAuth refresh token is persisted to a file/volume so it survives container restarts (unlike the other static keys).
- **Failure handling: retry-with-backoff on transient API errors, log to stdout (captured via Docker logs), no dedicated alerting channel.** This also covers the Twilio balance running out — it fails the same way as any other outage, by design, rather than needing separate low-balance alerting.

## Assumptions

- Single user, single WhatsApp number, single Google Calendar — no multi-tenancy anywhere in the design.
- Timezone is Europe/London; whatever scheduling library is used must handle BST/GMT transitions correctly.
- The exact tool list for the reactive agent, and the precise idle-timeout duration for conversation memory (~30 minutes), are implementation details to be settled during build, not fixed here.

## Open questions / Risks

- **Meta Business verification and WhatsApp template approval** (required for every proactive message type, even via Twilio) has unknown lead time. Should be started as early as possible, ahead of code that depends on it.
- **Google OAuth refresh tokens typically expire after 7 days while an app is in "testing" mode** unless the app is published or the user is added as a test user. Needs to be checked/handled during implementation so calendar access doesn't silently break a week after setup.
- **LLM tool-calling reliability**: even with the clarification-on-ambiguity flow, a misparsed request reaching a write-capable tool (`moveEvent`) is the single highest-consequence failure mode in this design. Worth extra defensive prompting/validation around write operations specifically.
- **Ongoing cost**: bounded by Twilio's prepaid balance (cannot exceed it), but nothing currently alerts the user if that balance is running low — per the stated failure-handling policy, it will simply stop working silently when exhausted.

## Verification

Not yet discussed — to be defined during implementation planning (e.g. manual end-to-end testing of each proactive trigger and each reactive calendar operation against a test calendar before relying on it for real).
