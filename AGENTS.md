## Project boundary

This is a standalone npm project for the Next.js API. Run commands from `web` and keep its source, tooling, documentation, dependencies, and lockfile here. The parent folder must contain only `web` and `mobile`; do not create root workspace files or shared packages outside them. Keep reusable validation schemas in `src/zod`, reusable behavior in `src/libs`, and database types in `src/database/types`.

## Source organization

- Keep `src` organized by responsibility. Do not add miscellaneous implementation files directly under `src`; every source file must live in an appropriate named folder.
- Put general utilities and service helpers in `src/libs`. Group related utilities further when a domain has multiple files.
- Put table-specific database access in `src/database`. Use one file per table or database domain (for example, `src/database/user.ts` contains all queries and mutations for the user table). Put cross-table workflow orchestration in `src/libs`.
- Name each database file for exactly one table or database domain. Keep its exported functions focused on that table and use standard CRUD names such as `find`, `list`, `create`, `update`, and `delete`. Put cross-table orchestration in a domain service that composes these table-focused functions.
- Put database-only types in `src/database/types`. Do not scatter generated row types, insert/update types, or database mapping types through feature folders.
- Put Zustand stores in `src/store`. Each file must define one independently scoped Zustand store.
- Put reusable Zod schemas in `src/zod`. Split schemas into files by feature or validation purpose, and import them wherever validation is needed.
- Do not duplicate validation schemas in page, component, database, or store modules. Reuse the appropriate schema from `src/zod`.

## Pages and components

- Every page directory must contain a local `_components` directory for components used only by that page or route segment.
- Keep page-specific components in the nearest page's `_components` directory. Do not move them into `src/components` until they are reused outside that page.
- Put components shared by multiple pages, page component trees, or unrelated features in `src/components`.
- Define one React component per file. Small private render helpers are allowed only when they are not standalone components and are not reused.
- A simple component may be a single file. When a component has substantial state, event orchestration, data-flow logic, or any `useEffect`, give it its own directory with `index.tsx` for rendering and `hook.ts` for its logic. The component must consume the hook rather than embedding that logic in the JSX file.
- Keep `index.tsx` focused on composition, markup, and binding values returned by `hook.ts`. Keep the hook focused on state, effects, derived values, callbacks, and interaction logic.
- Use Tailwind CSS classes for component styling. Do not add CSS Modules, styled-components, or ad hoc inline style objects. Reserve global CSS for Tailwind setup, design tokens, resets, and truly global rules.

Example page layout:

```text
app/dashboard/
  page.tsx
  _components/
    stats-card/
      index.tsx
      hook.ts
    empty-state.tsx

src/
  components/
    button.tsx
  database/
    user.ts
    types/
      user.ts
  libs/
    dates.ts
  store/
    session.ts
  zod/
    profile.ts
```

## Forms and validation

- Build forms with React Hook Form.
- Define form validation with Zod and connect it through the Zod resolver (`zodResolver`). Do not duplicate validation rules in manual submit handlers.
- Keep reusable schemas in `src/zod`; a schema that is genuinely private to one page may stay inside that page's feature directory.
- Infer TypeScript form values from the Zod schema whenever practical so the runtime validation and static types remain aligned.

## TypeScript and formatting

- Write named functions as `const` arrow functions. Do not use `function` declarations, except where a framework makes them unavoidable.
- Run Prettier before finishing. Keep an empty line after imports, between exported declarations, after setup or guard groups, and before a final return when it improves readability. Do not compress multiple logical steps onto one line.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
