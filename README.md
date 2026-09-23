# Pox API and background jobs

This workspace is the React Native app's API backend. It contains Next.js Route Handlers, Supabase migrations, and Trigger.dev jobs. There is no web UI. Normal record and collaboration operations continue to use the authenticated Supabase SDK and database RPCs directly.

## Local setup

Use Node 24+, npm, Docker Desktop running Linux containers, and the Supabase CLI. Run `npm install` at the repository root. Development and production must use separate Supabase and Trigger projects.

From `backend`, copy `.env.example` to `.env.local`. Start Docker, then run:

```powershell
npx supabase start
npx supabase db reset
npx supabase status
```

`db reset` rebuilds the **local development database** and discards its data. Never use it against a shared environment. Copy the local URL, anon key, and service-role key from Supabase status into the corresponding backend environment variables. Do not paste service-role credentials into mobile configuration.

Configure `OPENAI_API_KEY` for text and voice features. The default models remain `gpt-4.1-mini` and `gpt-4o-mini-transcribe`, overridable with the documented environment variables. API startup and local tests do not require working OpenAI credentials; AI requests do.

From the repository root:

```powershell
npm run dev --workspace @pox/backend
```

Check `http://localhost:3000/api/health`. This endpoint confirms that the API process is alive, not that Supabase, OpenAI, or the worker is configured. Protected endpoints require `Authorization: Bearer <Supabase access token>`.

## Google authentication and physical phones

Create a Google OAuth client and configure its credentials in the Supabase Auth environment. Enable the existing Google provider section in `supabase/config.toml` for local development. Register the Supabase Auth callback URL shown by your environment with Google; allow `pox://auth/callback` as an app redirect in Supabase. Restart the local Supabase stack after changing provider configuration. Next.js `.env.local` is not automatically the shell environment used by Supabase CLI: supply the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` variables to the CLI process too.

For a physical phone, `localhost` points to the phone. Set `EXPO_PUBLIC_API_URL` to the computer's LAN address on port 3000, or an HTTPS development tunnel. The phone also needs a reachable Supabase URL on port 54321. A Metro tunnel does not expose either backend service. Allow the required development ports on your private network. Use a development build for Google sign-in and notifications. An HTTPS development endpoint avoids platform cleartext-network restrictions.

## Worker setup

Set `TRIGGER_PROJECT_ID` and `TRIGGER_SECRET_KEY` for a development project. Start the Trigger CLI from `backend`:

```powershell
npx trigger.dev@4 dev --env-file .env.local
```

Keep the development worker connected and confirm the `pox-reminders` schedule in the Trigger dashboard. The cron runs once per minute; exact-to-the-second notification timing is not promised. The Trigger worker needs its own Supabase and optional Expo credentials. In a deployed worker, `127.0.0.1` will not reach your development computer.

Set `EXPO_ACCESS_TOKEN` when enhanced push security is enabled in Expo. Mobile EAS configuration and native push credentials remain necessary for device delivery. Receipt checks start after 15 minutes and stop after 24 hours. Provider acceptance is not proof that a device displayed the notification.

## API contracts

| Endpoint                       | Request                                                 | Response                                                         |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/ai/interpret`       | Text, time zone, reference time, optional clarification | Proposal plus `reviewId`                                         |
| `POST /api/ai/prepare`         | Reviewed proposal, `reviewId`, stable `requestId`       | `{ id }`                                                         |
| `POST /api/ai/apply`           | `{ id }`                                                | `{ records }`                                                    |
| `POST /api/ai/transcribe`      | Multipart `audio` file, nonempty and at most 10 MB      | `{ text }`                                                       |
| `POST /api/invitations/accept` | `{ token }`                                             | `{ spaceId }`                                                    |
| `POST /api/account/delete`     | `{ confirm: "DELETE" }`                                 | `{ deleted: true }`, or `DELETION_PENDING` while cleanup retries |

Errors have `{ error, code, requestId }` and an `X-Request-Id` header. JSON bodies are limited to 100 KB. Rate limits are per authenticated user and endpoint: 60 per hour, or 30 for transcription. Provider calls have bounded timeouts and no implicit retries; the user retains their input when retrying.

The mobile capture caller was updated with the API. Older clients without a `reviewId` and preparation `requestId` must update before using AI preparation. A changed proposal needs a new request ID; retries of an unchanged proposal reuse it. Preparation rejects intervening edits; application checks versions and permissions again. Applied proposals return their saved result on replay even after the original review expiry.

## Persistence and scheduling

Apply migrations in order. Existing migrations are retained, and the September 23 migrations add validation, explicit function grants, review snapshots, deletion recovery, delivery attempts, recurrence anchors, and structured history. Historical invalid record data is not silently rewritten; fix any such rows through valid updates before expecting them to schedule.

Personal and shared changes remain guarded by RLS and versioned database writes. Function permissions explicitly revoke PostgreSQL's default `PUBLIC` execution rights. Account deletion first persists intent and blocks new writes; the worker retries cleanup and Auth deletion. Shared-space owners must transfer ownership or delete their spaces first.

Preferences and membership changes invalidate notification schedules without changing reminder content versions. Accepted tickets are persisted per device before another device is attempted. Unknown transport outcomes may be retried; exactly-once device display cannot be guaranteed. Claims carry expiring tokens so stale workers cannot commit results after a newer claim.

Recurring responsibilities produce independent occurrences without completing earlier ones. Monthly/yearly recurrence retains a calendar anchor, clamps missing days, and restores the original day when possible. DST gaps shift forward; overlaps use the earlier instant. Editing an occurrence's date establishes a new anchor for its future chain. Existing future instances are independent snapshots, not silently rewritten by edits to earlier occurrences.

## Verification and operations

```powershell
npm run typecheck
npm test
npm run lint --workspace @pox/backend
npm run format:check --workspace @pox/backend
npm run build --workspace @pox/backend
npm run db:types --workspace @pox/backend
```

`db:types` generates the shared database types from a fresh migrated PostgreSQL catalog using PGlite, so no cloud secrets are required. It covers the project's tables and RPC signatures; relationship metadata is not generated. For deployment validation, also run the migration reset and authenticated requests against actual local Supabase. Embedded PostgreSQL tests do not exercise PostgREST, GoTrue, Realtime transport, or Docker networking.

Tests cover HTTP boundaries, domain validation, RLS roles, proposal conflicts/replays, invitation removal, account cleanup, delivery leases, per-device retries, and recurrence dates. AI and push providers are mocked; live OAuth, provider quality, push credentials, and physical-device behavior require a separately configured development environment.

Monitor structured events `request_failed`, `outbox_failed`, `delivery_failed`, `recurrence_failed`, and `account_deletion_retry_failed`, along with the Trigger run status. Logs omit tokens and memory contents. Inspect failed deliveries, unconfirmed/failed receipts, outbox failures, and pending account deletions. Outbox expansion and delivery attempts are bounded to five attempts; investigate exhausted rows before resetting them for replay. Run migrations before starting the updated API/worker, then update the mobile client. Do not roll back to the old worker after enabling per-device delivery tracking.
