# Conventions

This document defines the coding standards and architectural patterns for the Nivelo (insulin-tracker) project. Every contributor and tool must follow these rules.

## Language & Types

- **TypeScript only** — no `.js` files in `src/`.
- **Zod for all input validation — frontend and backend.** Every form on the client and every API route that accepts input must validate through Zod schemas. The same schema should be shared between frontend and backend to guarantee consistency. No manual `if (!field)` checks anywhere.
- Zod schemas live in `src/lib/validation.ts` (shared schemas) or co-located with their service in `src/services/` (backend-only schemas).
- Infer TypeScript types from Zod schemas (`z.infer<typeof schema>`) instead of duplicating types.
- When a form submits data to an API route, the route handler must re-validate the payload with the same (or stricter) Zod schema — never trust client-side validation alone.

## Architecture — API-First + Service Layer

```
Client (pages) → API route handler → Service → Database (pool.query)
```

### API Route Handlers (`src/app/api/**/route.ts`)

- Route handlers are **thin controllers**: validate auth, parse + validate input with Zod, call a service function, return the response.
- **No direct database queries in route handlers.** All SQL lives in the service layer.
- Always validate authentication via `getAuthUser()` or `requireAuth()` from `src/lib/auth-middleware.ts`.
- Always return proper HTTP status codes and consistent JSON shape:
  ```ts
  // Success
  NextResponse.json({ data }, { status: 200 })
  // Error
  NextResponse.json({ error: "message" }, { status: 4xx })
  ```
- Always wrap handler logic in try-catch. Return 500 on unexpected errors with a generic message (never leak internal details).

### Service Layer (`src/services/`)

- One service file per domain: `measurements.service.ts`, `alerts.service.ts`, `appointments.service.ts`, etc.
- Services contain all business logic and database queries.
- Services receive plain typed arguments (not `Request` objects).
- Services throw typed errors or return result objects — they don't touch `NextResponse`.
- Reuse services across multiple routes when the same logic is needed.

### Pages (`src/app/**/page.tsx`)

- All pages are client components (`"use client"`).
- Data fetching happens via `fetch()` to API routes with `credentials: "include"`.
- No server actions. No direct database imports in pages.
- Prefer API routes (route handlers) over server actions unless explicitly specified otherwise.

## Database & Migrations

- **Every schema change must go through a migration file** managed by `node-pg-migrate`.
- Migration files live in `src/db/migrations/` and are created via `npm run migrate:create <name>`.
- Database functions, triggers, indexes, and seed data changes also require migration files.
- Never modify existing migration files that have been applied — create a new migration instead.
- Run migrations with `npm run migrate:up`. Rollback with `npm run migrate:down`.

## Authentication & Security

- **Every API route handler must validate auth** — no exceptions except `/api/auth/login`, `/api/auth/register`, and `/api/auth/logout`.
- Authorization checks must use the correct identity mapping: patients are identified by `patient_id` (not `user_id`). Use `resolvePatientId()` from `src/lib/patient-resolve.ts`.
- Doctor access to patient data must verify the doctor-patient relationship via the `patient_doctor` table.
- Never expose internal error details, stack traces, or database errors to the client.
- Rate limit public endpoints (login, register).

## Error Handling

- All route handlers must have try-catch with proper error responses.
- Services should throw descriptive errors for known failure cases.
- Log errors server-side with `console.error` and context (which endpoint, what input).

## Code Style

- No unnecessary abstractions — three similar lines are better than a premature helper.
- No comments unless the logic is non-obvious.
- No server actions unless explicitly requested.
- Spanish for user-facing strings (Argentine Spanish). English for code, variable names, comments.
