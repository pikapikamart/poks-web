# Database reference

Pox uses Supabase Postgres. Supabase Auth owns `auth.users`; the application owns the 20 tables in the `public` schema documented here. User, owner, actor, and assignee IDs ultimately identify authenticated users.

## Users and account lifecycle

### `profiles`

One profile per user. `id` matches `auth.users.id`. `display_name` is the name shown in the app, while `preferences` stores structured settings such as timezone, quiet hours, notification intensity, and default snooze duration.

### `account_deletions`

Tracks an account-deletion workflow and blocks new writes while deletion is underway.

| Column       | Meaning                          |
| ------------ | -------------------------------- |
| `user_id`    | User being deleted; primary key. |
| `created_at` | Time deletion was requested.     |
| `attempts`   | Cleanup attempt count.           |
| `last_error` | Most recent cleanup failure.     |

## Contexts and reminders

### `contexts`

Stores reusable Context templates. `content` contains the title, notes, instructions, and checklist steps. `owner_id` identifies the owner; `version` supports optimistic concurrency; `deleted` enables soft deletion; `updated_at` records changes; and `search_vector` supports full-text search. `kind`, `space_id`, and `recurrence_anchor` are retained by the normalized record shape.

### `reminders`

Stores all personal, shared, and Context-created Reminders.

| Column              | Meaning                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`                | Reminder UUID.                                                                                                      |
| `owner_id`          | User who owns the Reminder.                                                                                         |
| `space_id`          | Space containing it, or `null` for a personal Reminder.                                                             |
| `kind`              | Ordinary Reminder or Context-created instance.                                                                      |
| `content`           | Structured title, notes, instructions, schedule, completion, steps, assignments, priority, and recurrence settings. |
| `recurrence_anchor` | Calendar anchor that prevents recurring dates from drifting.                                                        |
| `version`           | Optimistic-concurrency version.                                                                                     |
| `updated_at`        | Last modification time.                                                                                             |
| `deleted`           | Soft-deletion flag.                                                                                                 |
| `search_vector`     | Generated full-text search data.                                                                                    |

### `context_reminders`

Join table connecting a Reminder to the Context used to create it. It contains `context_id`, `reminder_id`, and `created_at`. `reminder_id` is unique, so one Reminder can use at most one Context. Deleting either entity removes the join row.

### `reminder_recurrences`

Tracks the next occurrence of a recurring Reminder.

| Column               | Meaning                                          |
| -------------------- | ------------------------------------------------ |
| `parent_reminder_id` | Recurring parent Reminder; primary key.          |
| `next_reminder_id`   | Unique next generated occurrence, if one exists. |

Deleting the parent removes the recurrence row. Deleting the next occurrence clears `next_reminder_id`, allowing another occurrence to be generated.

### `reminder_operations`

Idempotency ledger for ordinary Reminder writes. Its primary key is the `user_id` and client-generated operation `id` pair. `result` stores the completed write result so retrying after a lost response does not mutate the Reminder twice.

### `reminder_outbox`

Transactional queue used to rebuild notification schedules after Reminder changes.

| Column        | Meaning                                                 |
| ------------- | ------------------------------------------------------- |
| `id`          | Monotonic queue identifier.                             |
| `reminder_id` | Reminder that changed.                                  |
| `revision`    | Reminder version to process; unique with `reminder_id`. |
| `generation`  | Notification generation for this event.                 |
| `processed`   | Whether scheduling completed.                           |
| `failures`    | Failed attempt count.                                   |
| `retry_at`    | Earliest next attempt.                                  |
| `last_error`  | Most recent worker error.                               |
| `created_at`  | Queue creation time.                                    |

## Spaces and collaboration

### `spaces`

Stores collaboration groups. Its columns are `id`, `owner_id`, `name`, and `created_at`. A Space owner must transfer or delete owned Spaces before deleting their account.

### `space_members`

Join table connecting users to Spaces. The `space_id` and `user_id` pair is the primary key. `role` is `owner`, `editor`, or `viewer` and controls access to shared Reminders.

### `space_reminders`

Join table connecting Spaces and shared Reminders. It contains `space_id`, unique `reminder_id`, and `created_at`, which permits at most one Space per Reminder. Deleting either entity removes its join row.

### `invitations`

Stores reusable Space invitation links.

| Column        | Meaning                                        |
| ------------- | ---------------------------------------------- |
| `id`          | Invitation UUID.                               |
| `space_id`    | Space the recipient will join.                 |
| `token`       | Unique token in the invitation link.           |
| `role`        | Role granted on acceptance.                    |
| `expires_at`  | Expiration time.                               |
| `revoked`     | Whether the owner disabled the invitation.     |
| `accepted_by` | User associated with acceptance, when present. |

### `collaboration_activity`

Stores collaborative Reminder events and Space discussion. `space_id` and `reminder_id` identify the related entities; `actor_id` identifies the user who caused the event; `event_type` classifies it; `body` is the visible message; `metadata` holds structured details; and `created_at` records the event time.

## Notifications

### `notification_inbox`

Stores in-app notifications. It currently contains completion activity for shared Reminders and checklist steps. Each row contains `id`, recipient `user_id`, optional `reminder_id`, `body`, `read`, `created_at`, and an optional unique `event_key` that prevents duplicate entries.

### `notification_devices`

Stores mobile push registrations. The Expo push `token` is the primary key, `user_id` owns it, and `updated_at` records the most recent registration refresh.

### `notification_epochs`

Stores one notification schedule generation per user. `user_id` is the primary key and `generation` increases whenever older scheduled work must become invalid.

### `notification_deliveries`

Stores logical notifications scheduled for individual users.

| Column        | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| `id`          | Delivery UUID.                                           |
| `reminder_id` | Related Reminder.                                        |
| `revision`    | Reminder version used to schedule it.                    |
| `user_id`     | Recipient.                                               |
| `kind`        | Due, nudge, or collaboration delivery type.              |
| `due_at`      | Time it becomes eligible to send.                        |
| `generation`  | Recipient schedule generation.                           |
| `body`        | Optional rendered message.                               |
| `status`      | Current processing state.                                |
| `attempts`    | Claim/send attempt count.                                |
| `lease_until` | Worker lease expiration.                                 |
| `claim_token` | Proof that a worker owns the lease.                      |
| `receipt_ids` | Aggregate receipt data retained on the logical delivery. |
| `last_error`  | Most recent error.                                       |

The Reminder revision, user, kind, and generation combination is unique, preventing duplicate logical notifications.

### `notification_device_deliveries`

Stores the per-device state of a logical notification. The `delivery_id` and Expo `token` pair is the primary key. `status`, `attempts`, `ticket_id`, `accepted_at`, `receipt_status`, and `last_error` track sending and final receipt processing. Deleting the parent `notification_deliveries` row removes its device rows.

## AI processing

### `ai_operations`

Stores one atomic, immediately applied AI command. Typed thoughts and voice recordings both use this table through `/api/ai/process`.

| Column         | Meaning                                                   |
| -------------- | --------------------------------------------------------- |
| `id`           | Internal operation UUID.                                  |
| `user_id`      | User who submitted the command.                           |
| `request_id`   | Client idempotency UUID; unique together with `user_id`.  |
| `request_body` | Original validated request.                               |
| `proposal`     | Structured AI interpretation.                             |
| `sources`      | Snapshot of Contexts and Reminders examined by the model. |
| `actions`      | Validated mutations built from the proposal.              |
| `dependencies` | Source IDs and versions that must still match.            |
| `status`       | `processing` or `completed`.                              |
| `result`       | Contexts and Reminders saved by the operation.            |
| `created_at`   | Start time.                                               |
| `completed_at` | Successful completion time.                               |

`apply_ai_operation` validates source versions and applies every action in one database transaction. Reusing the same request ID returns the saved result instead of creating duplicates. An AI response that only asks for clarification does not create an operation.

## API protection

### `api_rate_limits`

Stores atomic backend API rate-limit counters. The composite primary key contains `subject`, policy `bucket`, and `window_start`; `count` records requests consumed during that window.
