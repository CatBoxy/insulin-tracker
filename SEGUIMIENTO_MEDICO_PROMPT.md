# Implementation prompt — Seguimiento Médico for Nivelo

## Goal

Add a **Seguimiento Médico** feature to the Nivelo patient app that tracks recurring health checkups (specialist visits, labs, imaging) and surfaces overdue / upcoming items to patients. The target user is a Spanish-speaking adult with type-2 diabetes, frequently elderly, on a mobile phone. The UX must be calm, scannable, and impossible to misread — no calendars, no jargon, no decision fatigue.

---

## Existing app context

- **Next.js 14** (App Router) + **TypeScript** + **React 18**
- **PostgreSQL** with `node-pg-migrate`
- **JWT auth** via httpOnly cookies (`jose` + `bcrypt`)
- **Tailwind CSS**, **Recharts**, **Zod**
- Service layer at `src/services/` — each service is a file of named exports with direct `pool.query()` calls (no ORM). Controllers/routes are thin wrappers.
- PWA, Spanish UI (es-AR locale, timezone `America/Argentina/San_Juan`)
- Three roles: `patient`, `doctor`, `admin`
- Existing tables: `users`, `patients`, `doctors`, `patient_doctor`, `measurements`, `measurement_reference_ranges`, `alerts`, `appointments`, `prescriptions`, `prescription_items`, `device_tokens`
- Existing alert types are **plain string literals** in SQL — no enum or constants file. Current types: `measurement_critical`, `missed_logging`, `medication_expiring`, `custom`. We will add `checkup_due`.
- Existing alert check endpoints:
  - `POST /api/alerts/check` — checks inactivity and critical escalation (doctor/admin only)
  - `POST /api/alerts/check-refills` — checks expiring prescriptions
  - **There is no `/api/alerts/batch-check` endpoint.** Follow the existing pattern and create a new `POST /api/alerts/check-checkups` route.
- Existing middleware enforces JWT verification, role-based redirects, admin-only and doctor-only route guards
- Validation schemas live in a **single file** `src/lib/validation.ts` — add checkup schemas to this file (do NOT create a separate `validation/checkups.ts`)
- Migration naming convention: `YYYYMMDDHHMM00_kebab-case-description.sql` (e.g. `20260509180000_add-measurement-context.sql`)
- **No icon library is installed** — the app uses inline SVGs. Do NOT reference Lucide icons. Use inline SVGs or emoji for checkup type icons, matching the existing pattern.
- **No modal/dialog library is installed** — no Radix, no headless UI. The app uses simple inline conditional rendering with state (`{showForm && <div>...</div>}`). The `MarkCompletedDialog` must follow this same pattern: a conditionally rendered inline panel/section, NOT a modal or bottom sheet. Keep it simple.
- **No toast library** — the app uses inline `msg` + `msgType` state rendered as a colored banner div. Use this same pattern for success/error feedback.
- **`date-fns` is NOT installed.** The app uses native `Date` methods (`toLocaleDateString("es-AR")`, `toLocaleTimeString("es-AR")`). For relative time strings, use `Intl.RelativeTimeFormat` with the `es` locale, or compute them manually. Do NOT add `date-fns` as a dependency.
- **No test infrastructure exists** (no jest, vitest, or testing-library). Do not write tests unless asked to set up the test tooling first.
- The dashboard page (`src/app/dashboard/page.tsx`) is a **client component** (`"use client"`) — it fetches data client-side with `fetch()` in `useEffect`. It is NOT a server component. New dashboard integrations must follow this pattern.
- The doctor patient detail page (`src/app/doctor/patient/[id]/page.tsx`) uses a **tab system** with tabs: vitals, alerts, prescriptions, appointments. Add a new **"Seguimiento" tab** — do NOT add a separate panel outside the tab system.

**Match all existing conventions**: file structure, naming, Zod validation pattern, service-layer DB access, JWT payload shape, error response format, inline SVGs, inline state-based feedback, and error handling. Inspect the codebase before writing new code and mirror what's already there.

---

## Feature scope

### Patient flow
1. New "Seguimiento Médico" section accessible from `/dashboard` (compact summary panel) and a dedicated page `/dashboard/seguimiento` (full list).
2. List of all active checkup types for the patient grouped by status:
   - **Atrasado** — `next_due_at < now()`
   - **Próximo** — `next_due_at` within 30 days
   - **Al día** — `next_due_at` more than 30 days out
   - **Sin frecuencia fija** — checkup types with `frequency_months IS NULL` (e.g. nutrition)
   - **Sin registro previo** — checkups never marked complete (new patients)
3. Each item shows: specialty name, frequency, last completed date, next due date, and a time-relative label (`Venció hace 1 mes`, `En 12 días`, `Próximo: 22 ene 2027`).
4. Tap **"Marcar como realizado"** → expands an inline form (date input default = today + optional notes textarea) → submit. Status updates immediately without full page reload.
5. For patients with no completion history, show an onboarding prompt that lets them either enter a past date per checkup or skip ("Aún no me hice este control").

### Doctor flow
1. On `/doctor/patient/[id]`, add a **"Seguimiento" tab** (alongside the existing vitals, alerts, prescriptions, appointments tabs) showing the patient's checkup status.
2. Doctor can:
   - Override frequency per checkup type per patient (e.g. labs every 3 months instead of 6)
   - Deactivate a checkup type for a patient (e.g. nephrology not relevant)
   - Mark a checkup as completed on behalf of the patient
3. Reactivating a deactivated checkup type preserves completion history.

### Alert integration
- Add a new alert type `checkup_due` to the existing alerts system.
- Severity mapping by days until due (positive = days until, negative = days overdue):
  - `days_until_due <= 30 AND days_until_due > 0` → `warning`
  - `days_until_due <= 0 AND days_until_due > -60` → `critical`
  - `days_until_due <= -60` → `emergency`
- Create a new `POST /api/alerts/check-checkups` endpoint (following the pattern of `/api/alerts/check` and `/api/alerts/check-refills`) to iterate all active `patient_checkups`, compute status, and emit/update alerts. Existing escalation logic for unread alerts must apply to this new type automatically.

### Appointments integration
- Add a nullable `checkup_type_id INT` column to `appointments` (FK to `checkup_types(id)`).
- When an appointment transitions to `completed` status (in the existing PATCH handler at `src/app/api/appointments/[id]/route.ts`) and has a non-null `checkup_type_id`, auto-insert a `checkup_completions` row for the matching `patient_checkups` row (idempotent — see edge cases). Add this logic to the `appointmentsService.update()` function or as a post-update hook in the route handler.
- Doctor appointment-creation UI: add an optional "Tipo de control" select alongside the existing appointment-type field in the appointment form on `/doctor/patient/[id]`.

---

## Data model (target schema)

Write a single migration file named following the convention (e.g. `20260511000000_add-seguimiento-medico.sql`). Create these tables and seed the 9 default checkup types.

```sql
CREATE TABLE checkup_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  display_name_es VARCHAR(100) NOT NULL,
  description_es TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('specialist', 'lab', 'imaging', 'other')),
  default_frequency_months INT,            -- NULL = sin frecuencia fija
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_checkups (
  id SERIAL PRIMARY KEY,
  patient_id INT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  checkup_type_id INT NOT NULL REFERENCES checkup_types(id),
  frequency_months_override INT,
  last_completed_at TIMESTAMPTZ,           -- denormalized for fast list queries
  active BOOLEAN DEFAULT TRUE,
  enabled_by_doctor_id INT REFERENCES doctors(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, checkup_type_id)
);

CREATE INDEX idx_patient_checkups_patient_active
  ON patient_checkups(patient_id) WHERE active = TRUE;

CREATE TABLE checkup_completions (
  id SERIAL PRIMARY KEY,
  patient_checkup_id INT NOT NULL REFERENCES patient_checkups(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  appointment_id INT REFERENCES appointments(id),
  notes TEXT,
  reported_by_user_id INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkup_completions_lookup
  ON checkup_completions(patient_checkup_id, completed_at DESC);

-- Trigger: keep patient_checkups.last_completed_at in sync with the latest completion
CREATE OR REPLACE FUNCTION sync_patient_checkup_last_completed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE patient_checkups
  SET last_completed_at = (
    SELECT MAX(completed_at) FROM checkup_completions
    WHERE patient_checkup_id = COALESCE(NEW.patient_checkup_id, OLD.patient_checkup_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.patient_checkup_id, OLD.patient_checkup_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checkup_completions_sync
AFTER INSERT OR UPDATE OR DELETE ON checkup_completions
FOR EACH ROW EXECUTE FUNCTION sync_patient_checkup_last_completed();

-- Add checkup_type_id to appointments
ALTER TABLE appointments
  ADD COLUMN checkup_type_id INT REFERENCES checkup_types(id);
```

### Seed data — `checkup_types`

| code | display_name_es | category | default_frequency_months | sort_order |
|---|---|---|---|---|
| `diabetologist` | Diabetólogo | specialist | 6 | 10 |
| `lab` | Laboratorio | lab | 6 | 20 |
| `cardiologist` | Cardiólogo | specialist | 12 | 30 |
| `neurologist` | Neurólogo | specialist | 12 | 40 |
| `nephrologist` | Nefrólogo | specialist | 12 | 50 |
| `ophthalmologist_fundus` | Oftalmólogo (fondo de ojo) | specialist | 12 | 60 |
| `abdominal_ultrasound` | Ecografía abdominal | imaging | 12 | 70 |
| `echocardiogram` | Ecocardiograma | imaging | 12 | 80 |
| `nutrition` | Nutricionista | other | NULL | 90 |

### Status computation

`next_due_at` is **never stored** — always computed in the query:

```sql
COALESCE(pc.frequency_months_override, ct.default_frequency_months) AS frequency_months,

CASE
  WHEN COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NULL THEN NULL
  WHEN pc.last_completed_at IS NULL THEN NULL
  ELSE pc.last_completed_at
       + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
END AS next_due_at,

CASE
  WHEN COALESCE(pc.frequency_months_override, ct.default_frequency_months) IS NULL THEN 'sin_frecuencia'
  WHEN pc.last_completed_at IS NULL THEN 'sin_registro'
  WHEN pc.last_completed_at
       + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
       < NOW() THEN 'atrasado'
  WHEN pc.last_completed_at
       + (COALESCE(pc.frequency_months_override, ct.default_frequency_months) || ' months')::INTERVAL
       < NOW() + INTERVAL '30 days' THEN 'proximo'
  ELSE 'al_dia'
END AS status
```

### Auto-provision on patient registration

When a new patient is created (in `src/services/auth.service.ts` → `createUser()`, after the `INSERT INTO patients` query at line 46), insert one `patient_checkups` row per `checkup_type` with `active = TRUE`, `last_completed_at = NULL`, `enabled_by_doctor_id = NULL`. The 9 rows give the patient a fully-formed Seguimiento Médico section from day one, all in the "Sin registro previo" bucket until the onboarding prompt is completed.

---

## API surface

All routes use the existing JWT middleware (`requireAuth` or `getAuthUser` from `@/lib/auth-middleware`). Validation with Zod schemas added to `src/lib/validation.ts`. Business logic at `src/services/checkups.service.ts` — controllers/handlers should be thin.

### Patient routes

- `GET /api/checkups`
  Returns the authenticated patient's active checkups with computed status, sorted by `(status_priority, sort_order)`. Status priority: `atrasado` → `sin_registro` → `proximo` → `al_dia` → `sin_frecuencia`. Single round trip — no N+1.

  Response shape:
  ```ts
  {
    checkups: Array<{
      id: number;
      code: string;
      display_name_es: string;
      category: string;
      frequency_months: number | null;
      last_completed_at: string | null;       // ISO
      next_due_at: string | null;             // ISO, computed
      status: 'atrasado' | 'proximo' | 'al_dia' | 'sin_frecuencia' | 'sin_registro';
      days_until_due: number | null;          // negative if overdue
    }>;
    has_onboarding_pending: boolean;          // true if any status === 'sin_registro' for fixed-frequency types
  }
  ```

- `POST /api/checkups/[id]/complete`
  Body: `{ completed_at: string (ISO date), notes?: string }`. Inserts a `checkup_completions` row. Idempotency: reject (HTTP 409) if a completion exists within ±24h of `completed_at` for the same `patient_checkup_id`. Authorisation: caller must own the underlying patient row.

- `POST /api/checkups/onboarding`
  Body: `{ entries: Array<{ patient_checkup_id: number, last_completed_at: string | null }> }`. For each non-null `last_completed_at`, insert a `checkup_completions` row with `notes = 'Registro inicial'`. Null entries are no-ops. Single transaction.

### Doctor routes

- `GET /api/doctor/patient/[id]/checkups` — same shape as patient route, but for the specified patient. Authorisation: doctor must have an `active` `patient_doctor` row.

- `PATCH /api/doctor/patient/[id]/checkups/[checkupId]`
  Body: `{ frequency_months_override?: number | null, active?: boolean }`. Updates the row. Returns the updated row with recomputed status.

- `POST /api/doctor/patient/[id]/checkups/[checkupId]/complete`
  Same body as the patient version. Sets `reported_by_user_id` to the doctor's `user_id`.

### Alert check route

- `POST /api/alerts/check-checkups` — doctor/admin only (matching the pattern of `POST /api/alerts/check`). Iterates all active `patient_checkups` with fixed frequency, computes days until due, creates/updates `checkup_due` alerts at the appropriate severity.

---

## UI components

### Component tree (`src/components/checkups/`)

- `CheckupList.tsx` — main container, fetches `/api/checkups`, renders grouped sections. Props: `{ variant: 'full' | 'compact', patientId?: number }`. `compact` mode shows only the first overdue + first próximo card with a "Ver todos" link to `/dashboard/seguimiento`.
- `CheckupSection.tsx` — section header + cards container. Props: `{ title, status, items, renderItem }`.
- `CheckupCard.tsx` — actionable card used in all sections. Shows specialty name, frequency, status badge, last completed date, next due date, and relative time label. Includes inline expandable "Marcar como realizado" form (date input + notes textarea + submit button), toggled via state — same pattern as the appointment form on the doctor page.
- `CheckupStatusBadge.tsx` — pill component with status-appropriate colours (matching existing badge patterns like appointment status pills).
- `OnboardingPrompt.tsx` — component with one row per checkup type and three options each: "Sí, fue el [date input]", "Aún no me lo hice", "Lo decido después". Submits to `/api/checkups/onboarding`.

### Relative time labels

Compute relative time strings using native JS. Helper function pattern:

```ts
function getRelativeLabel(nextDueAt: string | null, status: string): string {
  if (!nextDueAt) return "Sin frecuencia fija";
  const now = new Date();
  const due = new Date(nextDueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (status === "atrasado") {
    const absDays = Math.abs(diffDays);
    if (absDays < 30) return `Venció hace ${absDays} días`;
    const months = Math.round(absDays / 30);
    return `Venció hace ${months} ${months === 1 ? "mes" : "meses"}`;
  }
  if (status === "proximo") {
    const fecha = due.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
    return `En ${diffDays} días · ${fecha}`;
  }
  // al_dia
  const fecha = due.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  return `Próximo: ${fecha}`;
}
```

### Pages

- `src/app/dashboard/seguimiento/page.tsx` — full list view, client component that fetches `/api/checkups` and renders `<CheckupList variant="full" />`.
- `src/app/dashboard/page.tsx` — add `<CheckupList variant="compact" />` panel between the appointments section and the quick-log input cards. Show only if `has_onboarding_pending === false`; otherwise show a single CTA card "Configurá tu seguimiento médico" linking to the onboarding flow.
- `src/app/doctor/patient/[id]/page.tsx` — add a `"seguimiento"` tab to the existing tab system (alongside vitals, alerts, prescriptions, appointments). The tab content fetches `/api/doctor/patient/{id}/checkups` and renders the checkup list with override and deactivate controls.
- `src/app/dashboard/seguimiento/onboarding/page.tsx` — onboarding flow, shown automatically on first visit when `has_onboarding_pending === true`. After submission, redirect to `/dashboard/seguimiento`.

---

## Mobile responsiveness requirements

This is a mobile-first feature targeting elderly users on phones. Implement and verify:

- **Touch targets**: all buttons, cards, and tappable rows must be **at least 44x44 px**.
- **Single column**: never lay out checkup cards in multiple columns. Even on tablet (768px+), keep a single column with a max-width container (`max-w-2xl mx-auto`).
- **Card spacing**: 12px between cards, 16-20px section padding, 24-32px between sections.
- **Date input**: use native `<input type="date">`. Do not pull in a custom JS date picker.
- **Inline forms**: The "Marcar como realizado" form expands inline below the card (same pattern as `{showApptForm && <div>...</div>}` on the doctor appointments tab). No modals, no bottom sheets.
- **Typography minimums**: body 14px (`text-sm`), primary action 16px (`text-base`), secondary metadata 12px (`text-xs`). Never smaller.
- **Contrast**: status colours must meet WCAG AA (4.5:1) against their background.
- **Test viewports**: 320, 375, 414, 768, 1024. No horizontal scroll at any width.

---

## Spanish copy (use exactly)

| Context | String |
|---|---|
| Page title | `Seguimiento médico` |
| Page subtitle | `Tus controles de salud` |
| Section: Atrasado | `Atrasado` |
| Section: Próximo | `Próximo` |
| Section: Al día | `Al día` |
| Section: Sin frecuencia | `Sin frecuencia fija` |
| Section: Sin registro | `Sin registro previo` |
| Primary action (card) | `Marcar como realizado` |
| Doctor: change frequency | `Cambiar frecuencia` |
| Doctor: deactivate | `Desactivar control` |
| Doctor: reactivate | `Reactivar control` |
| Inline form title | `Registrar control` |
| Inline form date label | `¿Cuándo lo hiciste?` |
| Inline form notes label | `Notas (opcional)` |
| Inline form submit | `Guardar` |
| Inline form cancel | `Cancelar` |
| Onboarding title | `Configurá tu seguimiento` |
| Onboarding intro | `Decinos cuándo fue la última vez que te hiciste cada control. Si nunca te hiciste alguno, está bien también.` |
| Onboarding option A | `Sí, fue el…` |
| Onboarding option B | `Aún no me lo hice` |
| Onboarding option C | `Lo decido después` |
| Onboarding submit | `Guardar y continuar` |
| Empty state (nutrition) | `Sin frecuencia fija — registrá tus visitas para llevar un historial` |
| Relative: overdue | `Venció hace {distance}` |
| Relative: upcoming | `En {n} días · {fecha}` where fecha is `d MMM yyyy` in es-AR |
| Relative: al día | `Próximo: {fecha}` |
| Success message | `Control registrado` |
| Error message | `No pudimos guardar el control. Intentá de nuevo.` |
| Doctor tab label | `🩺 Seguimiento` |
| Dashboard CTA | `Configurá tu seguimiento médico` |

Use native `toLocaleDateString("es-AR", ...)` for all date formatting. Render in the patient's timezone (`America/Argentina/San_Juan`).

---

## Edge cases to handle

1. **New patient, no completions** → all fixed-frequency types appear in "Sin registro previo"; the dashboard CTA links to onboarding instead of showing the compact list.
2. **Doctor deactivates a checkup** → row hidden from patient list, completions preserved, can be reactivated by any doctor with `active` link to the patient.
3. **Past-dated completion** → accept any `completed_at <= now()`. Future-dated completions rejected with HTTP 400.
4. **Frequency override change** → `next_due_at` recomputes on the next read. If the override moves a checkup between status buckets, the patient sees it shift on next refresh — no special migration needed since status is computed.
5. **Appointment auto-completion idempotency** → before inserting a `checkup_completions` row from an appointment, check for an existing completion for the same `patient_checkup_id` within ±24 hours; if found, skip (don't duplicate).
6. **Concurrent completion** → unique constraint not needed; the ±24h idempotency check + transactional insert is sufficient. Last-write-wins on `notes`.
7. **Timezone** → store all timestamps as `TIMESTAMPTZ`. Always convert to `America/Argentina/San_Juan` for display. Date-only fields from the form (`<input type="date">`) submit as `YYYY-MM-DD` — parse them as **local midnight in the patient's timezone**, not UTC midnight (otherwise off-by-one in late-evening submissions).
8. **Doctor without active patient link** → 403 on all `/api/doctor/patient/[id]/checkups*` routes.
9. **Patient tries to mark a deactivated checkup as completed** → 404 (don't leak the existence of the deactivated row).

---

## Out of scope (do NOT implement)

- Push notifications (the existing `device_tokens` table is fine — separate ticket will wire the sender)
- Email or SMS reminders
- Lab result file attachments
- Google Calendar / iCal sync
- Sharing checkup history with external (non-Nivelo) doctors
- Patient-created custom checkup types (only the 9 seeded types)
- Weight tracking UI (separate feature)
- Bulk-edit on the doctor side (one checkup at a time is fine for v1)
- Tests (no test infrastructure exists — separate task)
- New dependencies (no date-fns, no Lucide, no Radix, no toast library)

---

## Acceptance criteria

1. Migration runs cleanly on a fresh DB and on an existing one with data. The 9 checkup types are seeded with correct frequencies.
2. New patient registration auto-creates 9 `patient_checkups` rows with `last_completed_at = NULL`.
3. A patient marks a checkup as completed → the card moves from "Atrasado" / "Próximo" / "Sin registro" to "Al día" without a full page reload (optimistic or re-fetch update).
4. A doctor changes a patient's lab frequency from 6 to 3 months → on next page load the patient sees the updated next-due date and the card may have changed sections.
5. The `POST /api/alerts/check-checkups` endpoint emits `checkup_due` alerts at the right severity for warning / critical / emergency thresholds.
6. Completing an appointment with a non-null `checkup_type_id` auto-creates a `checkup_completions` row and the patient sees the corresponding checkup move to "Al día".
7. On a 375px-wide viewport: no horizontal scroll, all tap targets >= 44px, inline forms expand cleanly.
8. The patient list endpoint returns the full grouped data in a single SQL query (verify with logging — no N+1).
9. All Spanish copy exactly matches the table above.
10. Onboarding prompt appears for patients with no completion history. After submission, the dashboard switches from the CTA card to the compact `<CheckupList variant="compact" />`.
11. All new code passes the project's existing lint and type-check.
12. Zod schemas are added to `src/lib/validation.ts` (not a separate file).
13. Doctor patient detail page uses a new "Seguimiento" tab, not a separate panel.
14. All UI feedback uses inline `msg`/`msgType` state banners, not toasts.
15. No new npm dependencies are added.

---

## Implementation order (suggested)

1. Migration + seeds + auto-provision in patient registration (`src/services/auth.service.ts`)
2. Zod schemas (add to `src/lib/validation.ts`)
3. Service layer (`src/services/checkups.service.ts`) with the status-computing query
4. Patient API routes (`/api/checkups`, `/api/checkups/[id]/complete`, `/api/checkups/onboarding`)
5. Patient UI components: `CheckupStatusBadge`, `CheckupCard`, `CheckupSection`, `CheckupList`
6. `/dashboard/seguimiento` page + compact dashboard integration
7. `OnboardingPrompt` + onboarding page
8. Doctor API routes (`/api/doctor/patient/[id]/checkups`, PATCH, complete)
9. Doctor UI: new "Seguimiento" tab on `/doctor/patient/[id]`
10. Appointment integration (column + handler in appointments service + "Tipo de control" select in form)
11. Alert check endpoint (`POST /api/alerts/check-checkups`)
12. Mobile QA pass at 320/375/414/768/1024

---

## When you're done

- Verify the migration is reversible (down script).
- Confirm there are no N+1 queries in the patient list endpoint (single SQL).
- Show me a short summary of: files added, files modified, new DB tables, new API routes, and any deviation from this spec with the reason.
