# Supabase database

The application uses Supabase Auth for identities and the following tables in the `public` schema. `auth.users` remains the identity source; tables that contain `user_id`, `owner_id`, or `actor_id` reference it.

## User and collaboration data

| Table                    | Purpose                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`               | Stores each user's display information, timezone, quiet hours, notification intensity, and default snooze preference. Its ID matches `auth.users.id`. |
| `spaces`                 | Stores collaboration groups and their owners.                                                                                                         |
| `space_members`          | Join table between users and Spaces. It stores the member's `owner`, `editor`, or `viewer` role.                                                      |
| `invitations`            | Stores reusable Space invitation tokens, the role granted, expiry, revocation state, and accepting user.                                              |
| `collaboration_activity` | Stores collaborative Reminder events, including the actor, Space, Reminder, event type, message, and metadata.                                        |

## Contexts and reminders

| Table                  | Purpose                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contexts`             | Stores reusable Context templates with their descriptions, checklist steps, versions, deletion state, and searchable content.                      |
| `reminders`            | Stores personal and shared reminders, including content, schedule, completion state, recurrence configuration, owner, version, and deletion state. |
| `context_reminders`    | Join table between Contexts and Reminders created from them. A Reminder currently has at most one Context.                                         |
| `space_reminders`      | Join table between Spaces and shared Reminders. A Reminder currently belongs to at most one Space.                                                 |
| `reminder_recurrences` | Connects a recurring parent Reminder to its next generated Reminder occurrence.                                                                    |
| `reminder_operations`  | Stores the result of each Reminder write operation so retrying the same operation ID does not write the Reminder twice.                            |
| `reminder_outbox`      | Transactional queue of Reminder revisions whose notification schedules must be recalculated.                                                       |

## Notifications

| Table                            | Purpose                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `notification_inbox`             | Stores in-app notifications. It currently contains completion activity for shared Reminders and checklist steps.            |
| `notification_devices`           | Stores Expo push tokens registered by a user's devices.                                                                     |
| `notification_deliveries`        | Stores scheduled notification jobs for individual users, including due reminders, nudges, and collaboration activity.       |
| `notification_device_deliveries` | Tracks each device delivery attempt, Expo ticket, receipt status, retry state, and delivery error.                          |
| `notification_epochs`            | Stores each user's notification schedule generation. Incrementing it invalidates deliveries created from an older schedule. |

## AI processing

| Table           | Purpose                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai_operations` | Stores one immediately applied AI command. It contains the stable request ID, original request, interpreted proposal, source snapshot, database actions, source-version dependencies, status, and saved result. Replaying the same request returns the original result without creating duplicate reminders. It replaces `ai_reviews` and `ai_proposals`. |

The `/api/ai/process` route handles typed thoughts and voice recordings through the same workflow. If the AI needs clarification, it returns the question without creating an operation. Once the command is actionable, `apply_ai_operation` validates current source versions and applies every generated action atomically in the same database transaction.

## Reliability and account lifecycle

| Table               | Purpose                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `api_rate_limits`   | Stores atomic request counts by subject, API bucket, and time window.                                                               |
| `account_deletions` | Tracks account-deletion requests, cleanup attempts, and failures. Its presence also prevents new writes while deletion is underway. |

There is no `records` table or `members` compatibility view in the current schema. Code must use `contexts`, `reminders`, and `space_members` directly. `ai_reviews` and `ai_proposals` are also removed after the `ai_operations` migration.
