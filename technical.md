# Pox — Technical Context

## 1. Core Stack

Pox is a mobile-first application with a web application.

### Mobile

- React Native
- Expo
- TypeScript

### Web

- Next.js
- TypeScript
- Tailwind CSS

### Backend / Data

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage where needed

### Client Server-State Management

- TanStack Query

### HTTP

- Axios

### Forms

- React Hook Form
- Zod
- @hookform/resolvers

### Validation

- Zod

### Formatting

- Prettier

### AI

- Server-side AI integration

### Notifications

- Expo Notifications / native push infrastructure

### Background Jobs

- A reliable scheduled-job system such as Trigger.dev or Inngest

---

# 2. Repository Architecture

The **Next.js application is the central web/backend repository**.

All Supabase infrastructure that belongs to the project should live inside this repository and be version controlled.

This includes:

- Supabase migrations
- Supabase configuration
- Database-related SQL
- Database functions where applicable
- Database types/generated types where appropriate
- RLS policies
- Database seed data where appropriate
- Supabase-related project configuration

The goal is for the database infrastructure to be reproducible from the repository.

Do not maintain production database changes manually without corresponding migration files.

---

# 3. Supabase Directory

The Next.js repository should contain the Supabase project infrastructure.

Conceptually:

```text
pox/
├── app/
├── components/
├── lib/
├── public/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── ...
├── package.json
└── ...
```

The exact Next.js project structure can evolve, but Supabase migrations must remain inside the repository.

---

# 4. Database Migrations

**Every database schema change must be represented by a migration.**

Examples:

- Creating tables
- Adding columns
- Removing columns
- Creating indexes
- Creating database functions
- Creating triggers
- Creating RLS policies
- Changing constraints
- Changing relationships

Do not make undocumented manual production schema changes.

The migration history should allow a fresh environment to reproduce the required database structure.

---

# 5. Supabase as Source of Truth

Supabase PostgreSQL is the primary source of truth for persistent application data.

Potential entities include:

- Profiles
- Reminders
- Contexts
- Context items
- Context instances
- Instance items
- Groups
- Group members
- Assignments
- Notifications
- Notification preferences
- Activity/history
- Invitations

The exact schema should be designed according to actual requirements rather than creating every possible table immediately.

---

# 6. React Native → Supabase

React Native should directly use the Supabase client for normal authenticated application operations.

Examples:

- Fetch reminders
- Create reminders
- Update reminders
- Delete reminders
- Fetch Contexts
- Create Contexts
- Update checklist items
- Fetch groups
- Fetch shared Contexts
- Update normal user-owned data

Conceptually:

```text
React Native
      │
      │ Supabase SDK
      ▼
Supabase
      │
      ▼
PostgreSQL
```

This avoids unnecessarily routing every normal database operation through Next.js.

---

# 7. React Native → Next.js

The mobile application should communicate with Next.js/server endpoints when an operation requires trusted server-side logic.

Examples:

- AI requests
- Sensitive business logic
- Privileged operations
- Secure external API integrations
- Billing
- Webhooks
- Server-controlled notification operations

Use Axios for these HTTP requests.

Conceptually:

```text
React Native
      │
      │ Axios
      ▼
Next.js Server
      │
      ├── AI
      ├── Secure logic
      ├── External APIs
      └── Supabase
```

---

# 8. Next.js Web Application

Next.js is also the web client for Pox.

The web application will eventually provide:

- Account management
- Reminder management
- Context management
- Checklist management
- Group management
- Shared Contexts
- History
- Settings
- Billing
- Public/shared links
- Marketing pages
- Administrative functionality where appropriate

The web application uses the same Supabase backend as React Native.

---

# 9. Tailwind CSS

Use **Tailwind CSS for the entire Next.js web application**.

Tailwind is the primary styling system.

Avoid introducing additional styling systems without a strong architectural reason.

Reusable UI components should be built around the project's Tailwind design system.

The visual system should remain consistent across:

- Marketing
- Authentication
- Dashboard
- Reminders
- Contexts
- Groups
- History
- Settings
- Shared pages

---

# 10. TanStack Query

Use **TanStack Query** for server-state management.

It should handle:

- Queries
- Mutations
- Caching
- Refetching
- Loading states
- Error states
- Cache invalidation
- Optimistic updates where appropriate

Avoid unnecessarily creating custom server-state management abstractions when TanStack Query already provides the required functionality.

---

# 11. Axios

Use **Axios** for HTTP API communication.

Axios should primarily be used for:

- Next.js API endpoints
- AI endpoints
- External APIs
- Secure server operations

For direct Supabase operations, use the official Supabase client.

Do not route every Supabase query through Axios and Next.js without a reason.

---

# 12. React Hook Form + Zod

Use **React Hook Form** for forms.

Use **Zod** for validation.

Use the React Hook Form Zod resolver:

```text
React Hook Form
       ↓
Zod Resolver
       ↓
Zod Schema
       ↓
Validated Data
```

Use this pattern for forms such as:

- Reminder creation
- Reminder editing
- Context creation
- Context editing
- Checklist editing
- Group creation
- Profile settings
- Notification settings
- Account settings

Validation should exist on the client for UX and on trusted server boundaries for correctness/security.

---

# 13. TypeScript

Use TypeScript throughout the project.

Avoid unnecessary `any`.

Prefer strongly typed:

- API responses
- Database entities
- Form values
- Supabase queries
- AI outputs
- Component props
- Utility functions

Where practical, derive types from Zod schemas or generated Supabase database types instead of manually duplicating types.

---

# 14. Prettier

Use **Prettier** as the project's formatting standard.

Code formatting should be consistent throughout:

- Next.js
- React Native
- Shared packages/code
- Configuration files

Prettier should be integrated into the normal development workflow.

---

# 15. Authentication

Use Supabase Auth.

The same Pox account should work across:

- React Native
- Next.js

Authentication should be designed so additional login providers can be introduced later without requiring an architectural rewrite.

Never expose Supabase service-role credentials to the client.

---

# 16. Row Level Security

Supabase Row Level Security is mandatory.

Authorization must be enforced at the database level.

Users should only be able to access:

- Their own private data
- Data explicitly shared with them
- Groups they belong to
- Context instances they are authorized to access
- Checklist items they are authorized to modify

Do not rely exclusively on client-side checks.

Client-side checks are for UX.

Database-level authorization is the security boundary.

---

# 17. Realtime

Use Supabase Realtime for collaborative state where appropriate.

Example:

```text
Peter completes:
Background Study

        ↓

Supabase PostgreSQL

        ↓

Realtime event

        ↓

Ray's device

        ↓

Background Study ✓
```

Realtime subscriptions should be scoped appropriately.

Do not subscribe every client to unnecessary global changes.

---

# 18. AI Architecture

AI requests must happen server-side.

Never expose AI provider API keys in React Native or browser code.

Example:

```text
User:

"John is leaving next Friday.
Make sure we properly offboard him."

        ↓

React Native

        ↓ Axios

Next.js Server

        ↓

AI

        ↓

Employee Offboarding Context

        ↓

Server validation

        ↓

Supabase

        ↓

John's Offboarding instance
```

The AI should interpret the user's request.

The application/database remains the source of truth.

---

# 19. AI Output Validation

AI output must be validated before being used to modify important application state.

Use structured AI output where supported.

Validate the resulting structure using Zod.

For example:

```text
AI response
    ↓
Zod validation
    ↓
Valid structured result
    ↓
Application logic
    ↓
Supabase
```

Do not blindly trust arbitrary model output.

---

# 20. Reminder Scheduling

Reminder execution must not depend on the mobile application being open.

When a reminder is created:

```text
User
 ↓
Create reminder
 ↓
Persist reminder
 ↓
Schedule background job
 ↓
Nudge
 ↓
Main reminder
 ↓
Push notification
```

A reliable scheduled-job system should handle future execution.

Potential solutions include:

- Trigger.dev
- Inngest
- Another reliable background-job platform
- A dedicated queue/worker architecture if required later

Do not keep a Next.js request open waiting for a reminder.

---

# 21. Push Notifications

Pox depends heavily on reliable notifications.

The mobile application should register for push notifications and associate the device/token with the user's Pox account.

The backend determines when notifications should be sent.

The mobile device displays them.

Notification behavior should eventually support:

- Nudge
- Main reminder
- Repeated reminder
- Shared Context updates
- Assignment updates
- Invitations
- Completion updates
- Other relevant events

---

# 22. Notification Preferences

Users should eventually be able to configure:

- Notification intensity
- Nudge timing
- Reminder repetition
- Snooze behavior
- Quiet hours
- Priority behavior

Notification preferences should be persisted in Supabase.

---

# 23. Collaborative Data Model

Shared Contexts should represent shared state rather than separate copies.

Conceptually:

```text
Context
   │
   ▼
Context Instance
   │
   ├── Instance Item
   ├── Instance Item
   ├── Instance Item
   └── Instance Item
           │
           ▼
       Assignments
           │
      ┌────┴────┐
      ▼         ▼
    Peter      John
```

All authorized participants interact with the same underlying instance.

---

# 24. History / Activity

Important state changes can be recorded as activity/history events.

Potential events:

- Context created
- Context instance created
- User invited
- User accepted
- Checklist item completed
- Checklist item reopened
- Assignment changed
- Reminder created
- Reminder completed
- Context completed

History should be designed for useful accountability without unnecessarily complicating the system.

---

# 25. Security

Never expose:

- Supabase service-role keys
- AI provider keys
- Payment secrets
- Other server credentials

to React Native or browser clients.

Use environment variables for server-side secrets.

RLS must protect Supabase data.

Server-side endpoints must authenticate and authorize requests before performing privileged operations.

---

# 26. Environment Separation

Development and production environments should be separated.

Database migrations must be applied through the project's migration workflow.

Environment-specific secrets must never be committed to source control.

Use environment variables for:

- Supabase URLs
- Supabase keys
- AI credentials
- Notification credentials
- Payment credentials
- Other external services

---

# 27. Code Organization

The project should favor clear, predictable organization over excessive abstraction.

Avoid:

- Premature microservices
- Excessive wrappers
- Unnecessary repositories/services
- Multiple state-management libraries
- Multiple databases without a clear reason
- Custom authentication
- Custom realtime infrastructure
- Unnecessary backend layers

Prefer the simplest architecture that reliably supports the product.

---

# 28. Backend Responsibility

The backend should be responsible for:

- Authentication enforcement
- Authorization
- AI calls
- AI output validation
- Sensitive business logic
- Reminder scheduling
- Notification orchestration
- External integrations
- Billing operations
- Webhooks
- Other operations requiring trusted execution

Supabase should remain the primary persistent data layer.

---

# 29. Client Responsibility

React Native and Next.js clients should primarily handle:

- User interaction
- Rendering
- Local UI state
- Form interaction
- Calling Supabase for normal data operations
- Calling server endpoints for privileged operations
- Receiving realtime updates
- Receiving/displaying notifications

Business-critical security should not rely on the client.

---

# 30. Overall Architecture

The intended architecture is:

```text
                         ┌──────────────────────┐
                         │    React Native      │
                         │      Pox Mobile      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              Supabase SDK                      Axios
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐             ┌──────────────────┐
          │    Supabase     │             │     Next.js      │
          │                 │             │ Web + Server     │
          │ PostgreSQL      │◄────────────┤                  │
          │ Auth            │             │ AI               │
          │ Realtime        │             │ Secure Logic     │
          │ Storage         │             │ Integrations     │
          └─────────────────┘             └────────┬─────────┘
                                                    │
                                                    ▼
                                             Background Jobs
                                                    │
                                                    ▼
                                           Push Notifications
```

---

# 31. Source Control

The Next.js repository is the central source-controlled repository for:

- Next.js application
- Server-side logic
- Supabase migrations
- Supabase configuration
- Database functions
- RLS policies
- Database seed data where appropriate
- Shared technical documentation

All database changes should be represented in Git through Supabase migration files.

---

# 32. Development Principle

The architecture should remain:

> **Simple, typed, secure, reproducible, and scalable enough for Pox without premature complexity.**

The primary technology choices are intentionally boring and proven:

**React Native + Expo**

**Next.js + Tailwind**

**Supabase + PostgreSQL**

**TanStack Query**

**Axios**

**React Hook Form + Zod**

**Prettier**

The complexity should exist where Pox actually needs it:

- Reliable reminders
- Notifications
- AI interpretation
- Collaboration
- Authorization
- Structured Contexts

It should not exist merely because the architecture can support it.
