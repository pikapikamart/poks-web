# Pox — App Context

## Product Overview

**Pox** is an AI-driven “don't forget” application.

Its fundamental purpose is:

> **You shouldn't have to remember everything yourself. Pox remembers it for you.**

Modern life requires people to keep track of an enormous number of small and large things:

- Remembering to send an email
- Buying something at the grocery
- Checking something in 10 minutes
- Canceling a subscription before a trial ends
- Preparing for a trip
- Completing work procedures
- Following up with someone
- Remembering school requirements
- Completing group projects
- Offboarding an employee
- Preparing documents
- Finishing multi-step processes

Pox acts as a **second memory**.

The user can simply tell Pox what they don't want to forget.

The product should feel lightweight, friendly, lively, and approachable rather than like a traditional corporate productivity application.

---

# Core Philosophy

The central philosophy is:

> **Tell Pox. Forget it.**

The user should not have to think about organizing tasks, selecting categories, creating complicated workflows, or remembering where they put something.

They simply tell Pox:

> “Remind me in seven minutes to check Reddit.”

> “Remind me tomorrow to send that email.”

> “Remind me next Wednesday about the thesis.”

> “John is leaving the company. Make sure we properly offboard him.”

Pox determines how much structure the request requires.

Simple things remain simple.

Complex things become structured.

Collaborative things become shared.

---

# Simple Memories

A simple memory is a single thing the user does not want to forget.

Example:

> “Remind me in 10 minutes to take a shower.”

Pox creates a simple reminder.

The user should not have to manually configure:

- Title
- Category
- Project
- Tags
- Priority
- Date
- Time

when natural language already provides the information.

Manual creation should still be available.

---

# Structured Memories

Some responsibilities are more complicated than a single reminder.

Example:

> “John is leaving the company. Make sure we properly offboard him.”

Pox can recognize that this corresponds to an existing Context.

The Context may contain:

- Remove GitHub access
- Remove Vercel access
- Remove Google Workspace access
- Remove Slack access
- Transfer files
- Recover equipment

Pox then creates a specific instance:

## John's Offboarding

- ☐ Remove GitHub access
- ☐ Remove Vercel access
- ☐ Remove Google Workspace access
- ☐ Remove Slack access
- ☐ Transfer files
- ☐ Recover equipment

The Context is reusable.

The instance represents the specific execution.

---

# Contexts

A **Context** is a reusable definition of how something should be handled.

A Context can contain:

- Checklist items
- Instructions
- People
- Responsibilities
- Optional metadata
- Recurring requirements
- Other structured information

Examples:

- Employee Offboarding
- Employee Onboarding
- Client Onboarding
- Travel Preparation
- Website Launch
- Monthly Business Closing
- School Research
- Thesis Preparation
- Moving House
- Vehicle Maintenance
- Event Preparation

A Context should be reusable rather than recreated every time.

---

# Context Creation

Users should be able to create Contexts using natural language.

For example:

> “Pox, create a context for our school's background study.”

Pox can help turn the description into a structured Context.

Example:

## School Background Study

- Choose research topic
- Gather related literature
- Write background
- Review sources
- Format citations
- Submit draft

Users should also be able to create and edit Contexts manually.

AI assists with creation, but the user's Context is the source of truth.

---

# Context Instances

A Context is reusable.

An instance is a specific execution of that Context.

Example:

**Context:**

Employee Offboarding

**Instances:**

- John's Offboarding
- Peter's Offboarding
- Maria's Offboarding

Each instance has its own:

- Progress
- Deadline
- Participants
- Assignments
- Completion state
- History

---

# Completion

A key Pox principle is:

> **A thing isn't really done just because the reminder was acknowledged.**

If a Context has six checklist items and only four are completed, the overall responsibility remains incomplete.

Example:

**John's Offboarding — 4/6**

- ✓ Remove GitHub
- ✓ Remove Vercel
- ✓ Remove Google
- ✓ Remove Slack
- ☐ Transfer files
- ☐ Recover equipment

Pox should keep the remaining work visible.

The user should not accidentally consider a structured responsibility complete while required items remain unfinished.

---

# Time

Time is optional.

Not everything needs a specific date or time.

### Time-based memory

Examples:

> “Remind me in 10 minutes.”

> “Remind me Wednesday.”

> “Our defense is in 10 days.”

These can trigger notifications.

### Undated memory

Example:

> “Make sure John gets properly offboarded.”

This can exist as an open responsibility without immediately generating a notification.

The user can assign a date/time later.

---

# Nudges

Pox should support a **nudge → reminder** experience.

Example:

User:

> “Remind me in 10 minutes to take a shower.”

Around 7 minutes:

> “You wanted to take a shower in about 3 minutes.”

At the requested time:

> “Time to take that shower.”

The nudge should be more subtle than the main reminder.

Users should eventually be able to control:

- Nudge timing
- Notification intensity
- Repetition
- Snooze behavior
- Priority
- Quiet hours

The goal is:

> **Help people remember without constantly annoying them.**

---

# Natural Language

Natural language is the primary interaction model.

Examples:

> “Remind me in five minutes to check the oven.”

> “Remind me tomorrow morning to send the email.”

> “Remind me three days before my free trial ends to cancel it.”

> “John leaves next week. Make sure we properly offboard him.”

> “Create a context for our thesis background study.”

> “Remind our research group that the first section is due Wednesday.”

> “Peter finished the literature review.”

> “Mark Vercel access as complete.”

Users should not need to learn Pox-specific commands.

They should speak naturally.

---

# AI

AI is the interpretation and assistance layer.

AI can:

- Understand natural-language reminders
- Extract dates and times
- Understand relative dates
- Identify relevant Contexts
- Help create Contexts
- Generate checklist structures
- Recognize people
- Help assign responsibilities
- Understand completion commands
- Handle clarification
- Help organize information

AI should **not become the source of truth** for important application state.

The user defines the Context.

AI understands the user's request and maps it to the user's existing structured data.

---

# Non-AI Usage

Pox must still work without AI.

Users can:

- Type reminders
- Create reminders manually
- Create Contexts manually
- Edit checklists
- Set dates/times
- Invite users
- Check items
- Manage groups

AI should make Pox easier, not make Pox unusable without AI.

---

# Collaboration

Pox supports shared responsibilities.

A Context instance can be shared with:

- Individuals
- Groups
- Teams
- School groups
- Work groups
- Families
- Other collaborators

A user can invite another person to participate.

The invited person receives an invitation and can accept it.

Once accepted, they can participate in the shared Context according to their permissions.

---

# Shared Checklist State

Shared Contexts use a common state.

Example:

**John's Offboarding**

- ✓ Remove GitHub
- ✓ Remove Vercel
- ☐ Remove Google
- ☐ Remove Slack
- ☐ Transfer files
- ☐ Recover equipment

John completes:

> Remove Vercel

Everyone participating sees:

> ✓ Remove Vercel

The checklist is not duplicated between users.

Everyone sees the same underlying state.

---

# Groups

Pox supports groups.

Example:

## School Research Group

Members:

- Peter
- John
- Maria
- Ray
- Anna

The group can share Contexts and reminders.

Example:

> “Our research defense is in ten days. Make sure everyone remembers.”

Or:

> “Remind our research group that the background study is due Wednesday.”

Groups are particularly useful for:

- Students
- Research teams
- Work teams
- Small businesses
- Project teams
- Event organizers
- Families
- Clubs

---

# Responsibilities

Shared Contexts can distinguish between overall responsibility and individual responsibility.

Example:

## Research Project

- ✓ Peter — Find related literature
- ☐ Maria — Write background
- ☐ John — Review citations
- ☐ Ray — Format references

The system should make responsibility visible.

---

# Lightweight Updates

Participants should be able to provide lightweight updates without leaving Pox.

Example:

> **Peter:** “I finished the first part.”

Or:

> **Peter completed Background Research**

This is intended to reduce the need to switch to another platform just to communicate basic progress.

Pox should **not automatically become a full chat application**.

Communication exists to support memory, coordination, and completion.

---

# History

Pox can retain history for completed and shared Contexts.

Example:

## John's Offboarding

Completed September 28, 2026

- GitHub access removed
- Vercel access removed
- Google access removed
- Slack access removed
- Files transferred
- Equipment recovered

History can provide:

- Accountability
- Process records
- Past activity
- Completion dates
- Reusable knowledge

---

# Priority

Not every memory has the same importance.

Possible priorities:

- Low
- Normal
- High
- Critical

Priority can influence notification behavior.

Natural language and Context information may help infer priority, while the user remains in control.

---

# Everyday Examples

### Cooking

> “Remind me in 12 minutes to check the oven.”

### Shopping

> “Remind me tomorrow to buy detergent.”

### Subscription

> “Remind me three days before my free trial ends to cancel it.”

### Work

> “Remind me at 4 PM to send the report.”

### Personal

> “Remind me tonight to call Mom.”

### Social

> “Remind me Saturday to reply to Peter.”

### Travel

> “Remind me two days before the trip to pack.”

---

# Structured Examples

## Employee Offboarding

Context:

- Remove GitHub
- Remove Vercel
- Remove Google
- Remove Slack
- Transfer files
- Recover equipment

Command:

> “John is leaving next Friday. Make sure we properly offboard him.”

Pox creates John's Offboarding instance.

---

## School Research

Context:

- Research topic
- Literature review
- Background study
- Methodology
- Draft
- Review
- Submission

Command:

> “Create a context for our thesis background study.”

Then:

> “Remind our research group that the first section is due Wednesday.”

---

## Travel

Context:

- Passport
- Tickets
- Accommodation
- Clothes
- Toiletries
- Chargers
- Documents
- Transportation

Command:

> “Remind me two days before the trip to prepare everything.”

---

# Shared Memory

The deeper concept behind Pox is:

> **A shared external memory for people.**

For an individual:

> “Don't make me remember this.”

For a couple:

> “Don't let us forget this.”

For a family:

> “Don't let us forget what needs to happen.”

For a student group:

> “Don't let us forget our research responsibilities.”

For a business:

> “Don't let us forget the process.”

For a team:

> “Don't let anything fall through the cracks.”

---

# Emotional Value

People constantly carry small pieces of information in their heads:

> “I need to do this later.”

> “I need to remember to tell him.”

> “I can't forget that.”

> “I need to cancel that.”

> “I have to submit this.”

> “I'll remember.”

And then they forget.

Pox should provide the feeling:

> **“It's in Pox. I don't need to keep thinking about it.”**

That feeling is central to the product.

---

# UX Philosophy

Pox should be:

- Simple
- Fast
- Friendly
- Lively
- Modern
- Approachable
- Slightly playful
- Helpful

It should not feel like a traditional corporate task manager.

The user should be able to:

**Open → Speak → Done.**

The ideal experience is extremely low friction.

---

# Simple by Default

Pox should not force users into:

- Projects
- Boards
- Tags
- Categories
- Productivity methodologies
- Complex workflows

Someone who only wants:

> “Remind me in 10 minutes.”

should be able to do exactly that in seconds.

Someone who needs:

> “Create a shared six-step employee offboarding process for John and notify the people responsible.”

should also be able to do that.

The principle is:

> **Simple on the surface. Powerful underneath.**

---

# Mobile-First

Pox is fundamentally a mobile application.

The phone is where people naturally experience:

> “Oh, I need to remember that.”

The product should eventually support convenient entry points such as:

- Voice input
- Home-screen widget
- Notification actions
- Lock-screen shortcuts where supported
- Share-sheet actions
- Wearable integrations where appropriate

The goal is to minimize the distance between:

**thinking of something**

and

**telling Pox about it.**

---

# Pox Should Work Quietly

A successful Pox user may not spend much time inside the app.

They use Pox when they need to externalize a thought.

Then Pox works in the background.

The ideal relationship is:

> **Use Pox quickly. Forget Pox exists. Let Pox remember.**

---

# Product Loop

## Simple

Think of something

↓

Tell Pox

↓

Pox understands

↓

Pox creates memory

↓

Pox waits

↓

Pox nudges

↓

Pox reminds

↓

User acts

↓

User completes

## Structured

Think of something

↓

Tell Pox

↓

Pox identifies Context

↓

Creates Context instance

↓

Assigns/shares responsibility

↓

Nudges/reminds

↓

People complete individual items

↓

Progress is shared

↓

Context becomes complete

↓

Pox records history

---

# Product Differentiation

The individual components already exist elsewhere:

- Reminders
- Checklists
- Notifications
- Group task management
- AI assistants

The differentiation comes from combining them around one simple idea:

> **Don't make me remember.**

The user does not start by managing tasks.

They start by **getting something out of their head**.

Pox determines how much structure is required.

A simple thought remains a reminder.

A complex responsibility becomes a Context.

A collaborative responsibility becomes a shared Context.

---

# Brand

Working product name:

# Pox

The name should have a friendly, memorable identity.

The brand should communicate:

- Memory
- Helpfulness
- Personality
- Simplicity
- Reliability

Potential positioning:

> **Pox — Don't Forget.**

> **Pox — Tell us. We'll remember.**

> **Pox — Your second memory.**

Final branding and naming should be validated separately.

---

# Product Definition

The simplest complete definition of Pox is:

> **Pox is an AI-powered external memory that lets you tell it what you don't want to forget, reminds you at the right time, and can turn complex responsibilities into shared, reusable workflows.**

The simplest user-facing definition is:

> **Tell Pox what you don't want to forget.**

The deeper promise is:

> **Pox doesn't just remind you that something exists. It helps make sure the thing actually gets done.**

---

# Core Design Principle

Everything in Pox should ultimately support one question:

> **“What would I otherwise have to remember?”**

Features should be evaluated against this question.

Pox should remain centered around:

- Memory
- Reminders
- Context
- People
- Responsibility
- Completion
- Coordination
- History
