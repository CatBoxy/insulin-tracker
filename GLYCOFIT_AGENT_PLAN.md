# GlycoFit — Agent Execution Plan

**Version 1.0 — 2026-07-31**
Living document. Re-read before starting any task. See §9 for the changelog.

---

## §0 How to use this document

This is the working plan for building GlycoFit. It is written for an agent executing tasks, not for a human reading start to finish.

- Tasks have stable IDs (`P0-1`, `P1-3`, …). Jc will reference them by ID.
- **Do not skip ahead.** Dependencies are listed per task and they are real — most exist because schema changes get expensive once patients are enrolled.
- Every task has **acceptance criteria**. A task is not done until they all pass. If you can't satisfy one, stop and report rather than working around it.
- **Ask before deviating.** If a task seems wrong or you find a better approach, say so before implementing it. This system has correctness constraints that aren't obvious from the code.
- If something in this plan conflicts with what you find in the codebase, the codebase is the fact and the plan is the intent — report the mismatch.

---

## §1 What this is and why it constrains you

GlycoFit is a health tracking platform for type-2 diabetes patients in San Juan, Argentina — mostly elderly, Spanish-speaking. Patients log glucose, blood pressure and weight, track medical checkups (*seguimiento médico*), and share data with their doctors.

**It is also the instrument of a clinical study.** Dr. Alfredo Strubia is using it for his final project in the Sociedad Argentina de Gerontología y Geriatría specialist course. The study runs six months, tests whether AI-personalized messaging improves self-monitoring and adherence in adults ≥60 with type-2 diabetes, and **cannot be re-run**. The independent variable — the messaging — is a feature of this system that does not exist yet.

### The four rules

These override normal engineering tradeoffs. When in doubt, they win.

1. **Data loss is unrecoverable.** There is no re-collection. Backups and uptime are P0, not hygiene.
2. **Every message must be provable.** What was sent, to whom, when, whether it was delivered, whether it was read, and whether behaviour followed. This is a measurement apparatus, not analytics — the thesis commits in writing to reporting message exposure, opening, reading and retention.
3. **A control-arm patient must never receive an intervention message.** Enforced server-side on every send path, audited. One leak invalidates the study.
4. **What differs between arms is configuration, not code.** Every intervention feature sits behind a flag resolved from the participant's arm at request time. No user-ID branching, no separate builds, no client-side gating.

### Study shape

- Two arms: **control** and **intervention**, roughly 50/50.
- **Total N is deliberately flexible.** Never hardcode a cohort size.
- Eligibility: **age ≥ 60**, type-2 diabetes, phone capable of installing the app.
- Six-month follow-up with baseline, ~month-3 and ~month-6 measurement points.
- Dependent variables: HbA1c, fasting glucose, lipid profile, urea, creatinine, BP, weight, height, abdominal circumference, frequency of self-monitoring, attendance at consultations.

---

## §2 Environment and conventions

### Repos

| | Web | Mobile |
|---|---|---|
| Path | `/home/juan/Development/insulin-tracker` | `/home/juan/Development/insulin-tracker-mobile` |
| Stack | Next.js 15.5.16, React 19, TypeScript, Tailwind, Recharts, Zod, PWA | Expo SDK 54, RN 0.81.5, React 19, Expo Router 6, TypeScript, Zod |
| Bundle / domain | glyco.fit | `com.glycofit.app` |

Git remote uses the SSH alias `github.com-catboxy`. Branch per feature when a PR is wanted; direct pushes to main are normal during active development.

### Conventions — preserve these

- **API-first.** All mutations go through Next.js route handlers → service layer → PostgreSQL. No direct DB access from pages or components. The same API serves web and mobile.
- **All SQL lives in `src/services/*.service.ts`.** No ORM. No server actions.
- All web pages are client components (`"use client"`), fetching via `fetch()`.
- Zod schemas live in the single file `src/lib/validation.ts`.
- Spanish UI copy, English code.
- No icon library (inline SVGs), no modal library, no toast library, no date-fns.
- Migrations: `node-pg-migrate`, files in `src/db/migrations/`, run with `npm run migrate:up`.
- Timezone is `America/Argentina/San_Juan` everywhere. Locale `es-AR`.

### Infrastructure

Hetzner VPS, Ubuntu 24.04. PM2 runs glycofit on port 3008 alongside cuyorental (3009) and lacalculadora (3000). Nginx + Let's Encrypt. PostgreSQL 16 on the same box, database `insulin_tracker`, 25 tables. CI/CD via GitHub Actions on push to main: `npm ci` → `npm run build` (standalone) → rsync → PM2 restart.

### Two ops rules that have already caused incidents

- **Never overwrite `.env` on the VPS.** Read first, append or merge only. Overwriting once wiped every environment variable during the rename.
- **Email and link URLs must use runtime `APP_URL`, never `NEXT_PUBLIC_*`.** Build-time variables bake in localhost and ship to production.

### Naming

Canonical product name is **GlycoFit** (matches the thesis). Domain stays `glyco.fit`. Use this spelling in all new UI copy, docs and message templates. Older code and docs may say "Glycofit" or "Nivelo" — correct these opportunistically, don't make a project of it.

---

## §3 Decisions log

Settled. Don't re-litigate without checking with Jc.

| Topic | Decision |
|---|---|
| Product name | GlycoFit |
| Age cutoff | ≥ 60, enforced at screening |
| Arms | Control + intervention, ~50/50 |
| Total N | Flexible — never hardcoded |
| Arm differences | Admin-managed feature flags, fully audited |
| Message channels | WhatsApp for reminders, push for in-app events. **Split by type — no message goes out on both** |
| WhatsApp provider | Meta Cloud API **direct, no BSP** |
| WhatsApp category | **Utility only.** Education/motivational content stays in-app on push |
| Message frequency | Start at 1/day; full schedule TBD. Must be data, not constants |
| Template authoring | Full admin UI with versioning and doctor approval |
| Android | Signed APK first, then Play Store |
| iOS | PWA + WhatsApp fallback. Native app is a stretch goal only |
| Personalization | Templates carry clinical content; model only selects, adapts tone, fills personal detail |
| Hosting | Hetzner for now; can move to Argentina quickly if required |

---

## §4 Task board

### PHASE 0 — Unblock and stabilize

*Goal: the system is safe to deploy to and safe to lose. Nothing else starts until this is done.*

---

**P0-1 — Fix `findAttachment()` in the attachments service**
Depends on: nothing
Files: `src/services/attachments.service.ts`

`findAttachment()` is called but never defined — this is currently uncommitted work that will throw at runtime. Implement it, or remove the call sites if they turn out to be dead code.

*Acceptance:* the module type-checks; every call site resolves to a real function; a manual fetch of an existing attachment returns it.

---

**P0-2 — Fix wrong service imports in the attachment route**
Depends on: P0-1
Files: `src/app/api/attachments/[id]/route.ts`

The route imports `appointmentsService` and calls methods that don't exist on it. Point it at `attachmentsService`.

*Acceptance:* route type-checks; GET and DELETE on a known attachment id behave correctly.

---

**P0-3 — Add the missing doctor authorization check** ⚠️ **SECURITY**
Depends on: P0-1
Files: `src/app/api/checkups/completions/[id]/attachments/route.ts`

Any authenticated doctor can currently read **any** patient's lab attachments. This is a patient-data exposure, not a bug. Before returning anything, verify the requesting doctor is linked to that patient through `patient_doctor` with an active status. Patients may only access their own.

Audit sibling attachment routes for the same gap while you're here.

*Acceptance:* a doctor not linked to the patient receives 403 and no data. **Write a test for this specific case** — it is one of the four required tests in §7.

---

**P0-4 — Add timeout, retry and terminal failure state to Gemini parsing**
Depends on: nothing
Files: `src/lib/gemini.ts`, `src/services/attachments.service.ts`

Parse jobs can currently sit in `processing` forever. Add a request timeout, a bounded retry with backoff, and a terminal `failed` status with the error recorded. The UI must be able to distinguish "still working" from "gave up".

*Acceptance:* a forced failure lands in `failed` with a message and does not retry indefinitely; a forced timeout does not hang the request.

---

**P0-5 — Commit the attachment feature**
Depends on: P0-1, P0-2, P0-3, P0-4
Files: repo-wide

Commit the previously uncommitted attachment work now that it's correct. Run the migration on production per `DEPLOY_ATTACHMENTS.md`. Configure Cloudinary and Gemini keys on the server — **append to `.env`, never overwrite**.

*Acceptance:* feature works end to end in production; migration applied; no secrets in the repo.

---

**P0-6 — Off-box backups with a verified restore**
Depends on: nothing
Files: server config, plus a script in the repo for reproducibility

Nightly `pg_dump` of `insulin_tracker` shipped **off the VPS**. Retention of at least 30 daily and 6 monthly. Then — and this is the part that matters — **perform a real restore into a scratch database and verify row counts against production.**

*Acceptance:* a restore has actually been performed and verified, and the procedure is written down. An untested backup does not count as done.

---

**P0-7 — Uptime monitoring and PM2 persistence**
Depends on: nothing

The app has previously been found not running and not even present in PM2. Add external uptime monitoring on a real health endpoint with an alert that reaches Jc. Verify `pm2 save` and `pm2 startup` so a reboot restores every process.

*Acceptance:* killing the process triggers an alert within 5 minutes; a simulated reboot brings glycofit back automatically.

---

**P0-8 — Sentry on both repos**
Depends on: nothing
Files: both repos

Add Sentry to web and mobile. **Then remove the `.catch(() => {})` blocks in the mobile app** and replace them with Sentry capture — during the study those swallow real failures invisibly.

*Acceptance:* a deliberate error appears in Sentry from both apps; no bare empty catch handlers remain in the mobile codebase.

---

**P0-9 — Fix the N+1 in the doctor patient list**
Depends on: nothing
Files: `src/services/doctor.service.ts`

`listPatients()` runs four subqueries per patient. Rewrite as a single query with joins or lateral subqueries.

*Acceptance:* one query per list call; identical output; measurably faster with 50+ patients.

---

**P0-10 — Add pagination to measurement endpoints**
Depends on: nothing
Files: `src/app/api/measurements/`, `src/services/measurements.service.ts`, both clients

Measurements currently pull up to 1000 rows. Add limit/offset or cursor pagination, defaulting to a sane page size, and update both clients.

*Acceptance:* endpoints accept pagination params and return total counts; charts still render correctly.

---

### PHASE 1 — Study infrastructure

*Goal: the database can represent the study. **All of Phase 1 must land before the first real participant is enrolled** — schema changes against live study data are painful and risky.*

---

**P1-1 — Study participants and arm audit tables**
Depends on: Phase 0 complete
Files: new migration, `src/services/study.service.ts` (new)

```sql
CREATE TABLE study_participants (
  id                SERIAL PRIMARY KEY,
  patient_id        INTEGER NOT NULL UNIQUE REFERENCES patients(id),
  participant_code  TEXT NOT NULL UNIQUE,
  arm               TEXT NOT NULL CHECK (arm IN ('intervention','control')),
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_version   TEXT NOT NULL,
  consent_signed_at DATE NOT NULL,
  baseline_hba1c    NUMERIC(4,2),
  withdrawn_at      TIMESTAMPTZ,
  withdrawal_reason TEXT
);

CREATE TABLE study_arm_audit (
  id             SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES study_participants(id),
  old_arm        TEXT,
  new_arm        TEXT NOT NULL,
  changed_by     INTEGER NOT NULL REFERENCES users(id),
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason         TEXT
);

CREATE TABLE study_screening_log (
  id            SERIAL PRIMARY KEY,
  patient_id    INTEGER REFERENCES patients(id),
  screened_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  eligible      BOOLEAN NOT NULL,
  reason        TEXT,
  screened_by   INTEGER REFERENCES users(id)
);

CREATE TABLE study_incidents (
  id             SERIAL PRIMARY KEY,
  participant_id INTEGER REFERENCES study_participants(id),
  occurred_on    DATE NOT NULL,
  kind           TEXT NOT NULL,   -- withdrawal | adverse_event | protocol_deviation | technical
  description    TEXT NOT NULL,
  recorded_by    INTEGER NOT NULL REFERENCES users(id),
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`participant_code` is what appears in every export — **names never leave the system**. Generate it as a short opaque code, not derived from the name or the patient id.

*Acceptance:* migration applies and rolls back cleanly; service functions to enrol, change arm (writing audit), withdraw, and look up by code.

---

**P1-2 — Arm enforcement gate** ⚠️ **CRITICAL**
Depends on: P1-1
Files: `src/services/messaging.service.ts` (new)

**One function** that every send path calls without exception — scheduled, manual, retry, batch, admin-triggered. It reads the arm from the database **at send time** (never from cache, never from a job payload), and refuses anything that isn't an active, non-withdrawn intervention participant. Every refusal is recorded with a reason.

This is the single most important guard in the system. Build it before the sender exists so there is never a send path that predates it.

*Acceptance:* the function refuses control-arm, withdrawn, and non-enrolled patients; every refusal writes a row; **there is no code path in the repo that sends a message without calling it.** Grep to prove this.

---

**P1-3 — Feature flags scoped to study arm**
Depends on: P1-1
Files: new migration, `src/services/features.service.ts` (new), `src/lib/features.ts`

```sql
CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feature_flag_arm_settings (
  flag_key   TEXT NOT NULL REFERENCES feature_flags(key),
  arm        TEXT NOT NULL CHECK (arm IN ('intervention','control')),
  enabled    BOOLEAN NOT NULL DEFAULT false,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flag_key, arm)
);

CREATE TABLE feature_flag_audit (
  id         SERIAL PRIMARY KEY,
  flag_key   TEXT NOT NULL,
  arm        TEXT NOT NULL,
  old_value  BOOLEAN,
  new_value  BOOLEAN NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT
);
```

Seed flags: `messaging_whatsapp`, `messaging_push`, `inactivity_protocol`, `education_module`, `appointment_reminders`, `in_app_feedback_messages`.

Expose one resolver: `isEnabled(flagKey, patientId)`. Patients not enrolled in the study resolve to a documented default (recommend: same as control).

**Guard rail:** flags must not be able to override P1-2. If `messaging_whatsapp` were wrongly enabled for the control arm, the send path's own arm check must *still* refuse. Two independent gates.

*Acceptance:* resolver returns correct values per arm; every toggle writes an audit row with actor and timestamp; a test proves a control participant with the flag wrongly enabled still receives nothing.

---

**P1-4 — Blood pressure schema migration** ⚠️ **DATA INTEGRITY**
Depends on: Phase 0 complete
Files: new migration, `src/services/measurements.service.ts`, `src/lib/validation.ts`, both clients

Diastolic BP is currently extracted from a free-text notes field with `notes.match(/diastolic:(\d+)/)`. **BP is a dependent variable of the thesis.** Fix before enrollment.

1. Add `systolic INTEGER` and `diastolic INTEGER` to `measurements`.
2. Backfill from existing notes. **Log every row that fails to parse** and produce a report for manual reconciliation — do not silently drop.
3. Add `CHECK (systolic > diastolic)` and matching Zod validation. This is roadmap item 7 from the 2026-03-24 partner meeting.
4. Update web and mobile to read and write the new columns.
5. Keep the regex as a read fallback for one release, then remove it.

*Acceptance:* no code reads diastolic from notes; the constraint rejects inverted values with a clear Spanish error; the backfill report exists and every unparsed row is accounted for.

---

**P1-5 — Lab results table and doctor-verified parsing**
Depends on: P0-5
Files: new migration, `src/services/labs.service.ts` (new), doctor UI

HbA1c, lipid profile, urea and creatinine have nowhere to live today.

```sql
CREATE TABLE lab_results (
  id            SERIAL PRIMARY KEY,
  patient_id    INTEGER NOT NULL REFERENCES patients(id),
  timepoint     TEXT NOT NULL CHECK (timepoint IN ('baseline','month_3','month_6','unscheduled')),
  collected_on  DATE NOT NULL,
  analyte       TEXT NOT NULL,
  value         NUMERIC(10,3) NOT NULL,
  unit          TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('manual','parsed')),
  verified_by   INTEGER REFERENCES users(id),
  verified_at   TIMESTAMPTZ,
  attachment_id INTEGER REFERENCES checkup_attachments(id),
  UNIQUE (patient_id, timepoint, analyte, collected_on)
);
```

Analytes: `hba1c`, `glucose_fasting`, `total_cholesterol`, `hdl`, `ldl`, `triglycerides`, `urea`, `creatinine`.

**The Gemini pipeline must produce doctor-verified values.** Flow: PDF uploaded → parsed → doctor sees proposed values in a review UI and confirms or corrects each → written to `lab_results` with `verified_by` set. Unverified parses stay in `checkup_parsed_results` and are **excluded from every export**. An AI-parsed number nobody checked cannot be a thesis dependent variable.

*Acceptance:* doctor review UI works end to end; unverified values never appear in exports; the unique constraint prevents duplicate timepoint entries.

---

**P1-6 — Abdominal circumference**
Depends on: nothing
Files: migration, service, doctor UI, mobile

A stated dependent variable with no column. Add `abdominal_circumference_cm` to the appropriate measurement or indices table and surface it in the doctor's patient view.

*Acceptance:* value can be recorded, edited and retrieved; appears in export.

---

**P1-7 — Interaction tracking**
Depends on: nothing
Files: migration, `src/lib/auth-middleware.ts` or a dedicated middleware, mobile `lib/api.ts`

The protocol's inactivity rule is: no clinical data logged **and** no interface interaction for ≥3 consecutive days. That conjunction requires tracking interaction, not just writes.

- Add `patients.last_interaction_at`, updated on app open / session start — **not only on data submission**.
- Add an `app_sessions` table (`patient_id`, `channel` web|mobile, `started_at`) for weekly engagement metrics.
- Reconcile with the existing `missed_logging` alert: either align it exactly to the protocol rule or add a separate `inactivity_3d` rule. **The code and the protocol must state the same rule** — flag it to Jc if they can't be reconciled.

*Acceptance:* opening the app without logging anything updates `last_interaction_at`; sessions are recorded from both clients.

---

**P1-8 — Server-side measurement window**
Depends on: nothing
Files: `src/services/measurements.service.ts`, `src/lib/validation.ts`

The 20-hour minimum between measurements is enforced client-side only. Frequency of self-monitoring is a dependent variable — a patient who can double-log corrupts the count. Move the check into the API and return a clear Spanish error.

*Acceptance:* a direct API call inside the window is rejected regardless of client; both clients handle the error gracefully.

---

**P1-9 — Enrollment and eligibility screening**
Depends on: P1-1
Files: admin UI, `src/services/study.service.ts`

Screening flow computing age from DOB and blocking enrollment under 60 with a clear message. Records the outcome in `study_screening_log` **even for people who don't enroll** — the protocol needs the recruitment funnel. Captures consent version and signature date at enrollment.

*Acceptance:* under-60 cannot be enrolled; ineligible screenings are recorded with a reason; enrollment assigns arm and generates a participant code.

---

**P1-10 — Admin panel**
Depends on: P1-1, P1-3, P1-9
Files: `src/app/(admin)/` web routes

Web only, admin role, guarded in `src/middleware.ts`. Sections:

- **Participants** — enrol, assign arm, record consent, view/edit codes, withdraw with reason. Arm changes require a reason and write to `study_arm_audit`.
- **Feature flags** — the per-arm matrix, with audit history visible inline.
- **Message monitor** — recent sends with status, failures, filters by participant and channel. *This is how you notice the scheduler broke on a Sunday.*
- **Users** — keep the existing user CRUD and doctor–patient assignment.
- **Study dashboard** — counts per arm, enrollment progress, participants with no data in N days, and **participants with broken channels** (dead push token, WhatsApp opted out). Silently broken delivery is the failure mode most likely to damage the study and it is invisible from the patient side.

Template management comes later, in P2-9.

*Acceptance:* non-admin roles get 403 on every admin route; every mutating action writes an audit row; the broken-channel list is accurate against seeded bad data.

---

### PHASE 2 — Messaging engine

*Goal: the study's independent variable exists, works, and is measurable. Build as **one engine with pluggable channels** — shared scheduler, templates, arm enforcement and log. `channel` is a column, never a fork in the code.*

---

**P2-1 — Messaging schema**
Depends on: P1-2, P1-3
Files: new migration

Full DDL in §5. Creates `message_templates`, `message_schedule_rules`, `messages`, `message_events`, `patient_channels`.

Key constraint: `messages.rendered_body` stores the message **verbatim as sent**, after personalization. Required for safety review and because the thesis must describe the intervention precisely enough to reproduce it.

*Acceptance:* migration applies and rolls back; indexes on `(participant_id, scheduled_for)` and `(status)`.

---

**P2-2 — Channel abstraction**
Depends on: P2-1
Files: `src/services/messaging/` (new directory)

A `Channel` interface with `send(message)` returning a provider id, plus adapters registered by name. The scheduler and log know nothing about WhatsApp or push specifics.

*Acceptance:* adding a third channel would require no changes to the scheduler or the log.

---

**P2-3 — WhatsApp Cloud API adapter**
Depends on: P2-2, and Jc completing the Meta setup in §6
Files: `src/services/messaging/whatsapp.ts`, `src/app/api/webhooks/whatsapp/route.ts`

- Send approved templates via the Cloud API using a system user token.
- Webhook endpoint consuming status callbacks, writing `sent` / `delivered` / `read` into `message_events` and updating `messages.status`.
- Verify the webhook signature. Handle out-of-order and duplicate events idempotently.
- Map provider errors to actionable states — invalid number, opted out, template paused.

**All templates must stay in the `utility` category.** Reminders tied to an expected action read as utility: cheap and no per-user frequency caps. Motivational and educational content risks being classified as `marketing` — roughly 10x the cost and subject to limits that could throttle the intervention. Education lives in-app on push.

*Acceptance:* a template message reaches a real handset; delivery and read events land in `message_events`; replaying a duplicate webhook doesn't double-write.

---

**P2-4 — Push adapter**
Depends on: P2-2
Files: `src/services/messaging/push.ts`, mobile `lib/notifications.ts`

The `device_tokens` table exists with no sender. Build it on Expo's push service.

Handle and **log** the real failure modes rather than assuming delivery: permission denied, token expired, app uninstalled, and aggressive background-process killing on many Android OEM builds. Dead tokens must mark `patient_channels.active = false` so the admin broken-channel list is accurate.

*Acceptance:* push arrives on a physical Android device; a revoked token is detected and deactivated.

---

**P2-5 — Scheduler**
Depends on: P2-2
Files: `src/services/messaging/scheduler.ts`, a cron entry or PM2 process

Evaluates `message_schedule_rules` and enqueues messages. Trigger types: `cron`, `inactivity`, `appointment_lead`, `checkup_due`.

Requirements:
- All times in `America/Argentina/San_Juan`.
- **Idempotent** — running twice in the same window must not double-send. Use a uniqueness guard on (participant, template, scheduled window).
- Calls the P1-2 arm gate for every candidate, before rendering.
- Respects `patient_channels.opted_in` and `active`.
- Records suppressions with a reason rather than dropping them silently.

**Start at 1 message/day.** The full schedule is TBD with Alfredo — it must be **data in `message_schedule_rules`, never constants in code.**

*Acceptance:* running the scheduler twice produces one message; control participants produce zero; suppressions are logged with reasons; a timezone test passes across a DST boundary.

---

**P2-6 — Inactivity protocol**
Depends on: P2-5, P1-7

Rule as specified: no clinical data logged **and** no interface interaction for ≥3 consecutive days → preventive physical-activity message. Days configurable via `message_schedule_rules.params`.

*Acceptance:* a patient who opens the app but logs nothing does **not** trigger it; a patient who does neither for 3 days does; it fires once, not daily, until the condition clears.

---

**P2-7 — Message telemetry and engagement metrics**
Depends on: P2-3, P2-4

Per message: queued → sent → delivered → read → acted upon (did a reading get logged within N hours of a reminder?). Per participant per week: messages received, opened, response rate, active days, sessions.

This is what supports the **dose-response secondary hypothesis**. Without it the study can only claim "the messaged group did better", which is a substantially weaker result than "benefit scaled with exposure".

*Acceptance:* weekly metrics computable per participant for an arbitrary date range; the acted-upon linkage is correct against seeded data.

---

**P2-8 — Personalization with guardrails**
Depends on: P2-1
Files: `src/services/messaging/personalize.ts`

The protocol says "with artificial intelligence". Free-form clinical message generation is hard to describe in a protocol and hard to defend to an ethics committee. The defensible shape:

- **Templates carry the clinical content**, authored and approved by Alfredo, versioned.
- The model may **select, adapt tone, and fill personal detail** — name, individual target, prescribed regimen, previously identified barriers.
- The model **never** produces dosing, a treatment change, or content outside an approved template.
- Validate output before sending: length bounds, no numerals introduced that weren't in the variables, no forbidden terms. **On validation failure, fall back to the unpersonalized template — never drop the message.**
- Store the final text verbatim in `rendered_body`.

*Acceptance:* a forced bad generation falls back cleanly and logs the fallback; `rendered_body` always matches what the provider received.

---

**P2-9 — Template authoring UI**
Depends on: P1-10, P2-1
Files: admin routes

- List templates by key with full version history.
- **Templates are immutable once used.** Editing creates a new version; it never mutates the old one. `messages.template_id` must always resolve to exactly the text that was sent.
- Editor with variable placeholders and live preview against a sample patient.
- Explicit **doctor approval** action stamping `approved_by_doctor` and `approved_at`. Unapproved templates cannot be activated.
- WhatsApp templates carry Meta submission state: draft → submitted → approved/rejected, with the rejection reason surfaced. Only Meta-approved **and** doctor-approved templates can go active.
- Schedule rules editable alongside the template.

Show a banner when editing an active template: *"this creates version N+1; the change will be reportable as a protocol deviation."* Mid-study wording changes should feel slightly effortful.

*Acceptance:* editing a used template creates a new version and leaves sent messages resolving to the original; unapproved templates cannot be activated.

---

**P2-10 — Escalation path**
Depends on: P2-5

An alert with no timely response creates **false reassurance** — this is named explicitly in the thesis framework as a risk. Implement: when a reading is out of range, who is notified, in what window, and what the patient is told to expect.

Also: the app is **not an emergency channel**. State this in the app and in template footers where it fits.

*Blocked on Alfredo* — see §8. Build the mechanism; the policy values come from him.

---

### PHASE 3 — Mobile

---

**P3-1 — Signed APK**
Depends on: nothing
Files: mobile repo, `eas.json`

Build a signed APK via EAS for direct install. This unblocks pilot testing immediately without waiting on store review.

*Acceptance:* APK installs on a clean Android device and connects to production.

---

**P3-2 — Play Store listing**
Depends on: P3-1

Play Console setup, store listing, and — importantly — a **published privacy policy URL** and an accurate **Data Safety form covering health data collection**. A health app gets more scrutiny than average. Internal testing track first, then production.

*Acceptance:* build passes review on the internal track; privacy policy live at a stable URL.

---

**P3-3 — Charts on mobile**
Depends on: P1-4
Files: mobile patient dashboard

Currently marked *"próximamente"*. Patients seeing their own trend is part of self-monitoring, not decoration. Mirror the web's reference ranges and thresholds.

*Acceptance:* glucose and BP trends render for a range of data volumes including empty and single-point.

---

**P3-4 — Split the oversized screens**
Depends on: nothing
Files: mobile patient dashboard, doctor patient detail

Both are 600+ lines. Split **before** adding charts and push, not after.

*Acceptance:* no screen file over ~250 lines; behaviour unchanged.

---

**P3-5 — Push notification setup on the client**
Depends on: P2-4

Permission request with a clear Spanish explanation, token registration, token refresh handling, and deep links into the relevant screen.

*Acceptance:* tokens register and refresh; tapping a notification lands on the right screen.

---

**P3-6 — Accessibility pass for an elderly cohort**
Depends on: P3-4

**Study-relevant, not cosmetic** — the thesis framework treats usability as a condition of the intervention working at all. Legible type at a real minimum size, high contrast, large tap targets, predictable navigation, few actions per task, clear error recovery, no timed interactions. Responsive audit at 320 / 375 / 414 / 768 / 1024.

*Acceptance:* documented pass at each width; text scales with OS font settings without breaking layout.

---

**P3-7 — Onboarding with guided practice**
Depends on: P3-6

First-run flow that walks a new patient through logging one reading. The framework calls for guided practice specifically for this population.

*Acceptance:* a first-time user can complete a logging task without external help.

---

**P3-8 — Parity gaps, lower priority**
Depends on: nothing

Body composition and doctor indices on mobile (medium — doctors may be fine on web). Prescription creation (low — doctors will use web). **Mobile admin panel: skip for the study**, the placeholder is fine.

---

### PHASE 4 — Analysis support

*Design now, finish before the analysis window.*

---

**P4-1 — De-identified analysis export**
Depends on: P1-1, P1-5

One row per participant per timepoint, keyed by `participant_code`, ready for SPSS / R / Jamovi. **Never includes names.** Unverified parsed lab values are excluded. Include arm, all dependent variables, and engagement metrics.

*Acceptance:* export contains no direct identifiers; opens cleanly in a stats package; row counts reconcile with enrollment.

---

**P4-2 — Engagement metrics export**
Depends on: P2-7

Per participant per week, joinable to P4-1 on participant code. This is the dose-response dataset.

---

**P4-3 — Patient PDF health summary**
Depends on: P1-5

For patients to share with external doctors.

---

**P4-4 — Shareable read-only patient report**
Depends on: P4-3

Read-only URL for third parties, from the March partner roadmap. Tokenized, expiring, revocable.

---

### PHASE 5 — Deferred

Physical activity logging. Health education content module (versioned, authored by Alfredo). General reminders beyond the protocol rules. Mobile admin panel. Native iOS. Astro VPS monitoring dashboard.

---

## §5 Reference — messaging DDL

```sql
CREATE TABLE message_templates (
  id                 SERIAL PRIMARY KEY,
  key                TEXT NOT NULL,
  version            INTEGER NOT NULL,
  channel            TEXT NOT NULL CHECK (channel IN ('whatsapp','push')),
  category           TEXT NOT NULL,
  locale             TEXT NOT NULL DEFAULT 'es_AR',
  body               TEXT NOT NULL,
  variables          JSONB NOT NULL,
  wa_template_name   TEXT,
  wa_status          TEXT,
  wa_approved_at     TIMESTAMPTZ,
  wa_rejection_reason TEXT,
  approved_by_doctor INTEGER REFERENCES users(id),
  approved_at        TIMESTAMPTZ,
  active             BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, version, channel)
);

CREATE TABLE message_schedule_rules (
  id           SERIAL PRIMARY KEY,
  template_key TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN
                 ('cron','inactivity','appointment_lead','checkup_due')),
  cron_expr    TEXT,
  params       JSONB,
  active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE messages (
  id                SERIAL PRIMARY KEY,
  participant_id    INTEGER NOT NULL REFERENCES study_participants(id),
  template_id       INTEGER NOT NULL REFERENCES message_templates(id),
  channel           TEXT NOT NULL CHECK (channel IN ('whatsapp','push')),
  trigger_rule_id   INTEGER REFERENCES message_schedule_rules(id),
  trigger_context   JSONB,
  rendered_body     TEXT NOT NULL,
  variables_used    JSONB NOT NULL,
  personalized      BOOLEAN NOT NULL DEFAULT false,
  scheduled_for     TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
                      ('queued','sent','delivered','read','failed','suppressed')),
  provider_msg_id   TEXT,
  suppressed_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON messages (participant_id, scheduled_for);
CREATE INDEX ON messages (status);

CREATE TABLE message_events (
  id          SERIAL PRIMARY KEY,
  message_id  INTEGER NOT NULL REFERENCES messages(id),
  event       TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_payload JSONB,
  UNIQUE (message_id, event, occurred_at)
);

CREATE TABLE patient_channels (
  id           SERIAL PRIMARY KEY,
  patient_id   INTEGER NOT NULL REFERENCES patients(id),
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp','push')),
  identifier   TEXT NOT NULL,
  opted_in     BOOLEAN NOT NULL DEFAULT false,
  opted_in_at  TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  active       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (patient_id, channel, identifier)
);
```

### Channel split — no message goes out on both

| Message type | Channel |
|---|---|
| Glucose self-monitoring reminder | WhatsApp |
| Blood pressure reminder | WhatsApp |
| Inactivity / activity prompt | WhatsApp |
| Appointment reminder | WhatsApp |
| Lab / checkup due | WhatsApp |
| Doctor reviewed your results | Push |
| Doctor left a note | Push |
| New education content | Push |

WhatsApp returns delivered **and read** receipts; push gives delivered-to-device at best and nothing reliable about whether it was seen. Keeping the measurable intervention entirely on WhatsApp keeps the exposure variable clean. Push is additive, never load-bearing.

---

## §6 Reference — Meta / WhatsApp onboarding

**This track is Jc's, not the agent's.** In progress as of 2026-07-31; a dedicated number is being acquired. P2-3 is blocked until it completes, but everything else in Phase 2 can proceed.

1. **Meta Business Portfolio** at `business.facebook.com`. Decide which legal entity owns it — Clínica Azul, Alfredo's practice, or Jc's entity. Must match the documents in step 2; the name is visible to patients.
2. **Business Verification.** Settings → Business Info → Start Verification. Upload legal name, address, proof of business — in Argentina typically the AFIP/ARCA constancia plus a utility bill or bank statement at the same address. Median time to production-ready is around 3–5 business days, verification review itself usually 2–4; budget 2–4 weeks if documents need rework. **Every field must match the documents exactly** — mismatches are the main cause of rejection and each rejection costs another cycle.
3. **Meta App** at `developers.facebook.com`, WhatsApp product added.
4. **WABA** under the verified portfolio, with a display name representing the business.
5. **Phone number** — dedicated, **not active on consumer WhatsApp or the WhatsApp Business app** (deregister first if it is), able to receive SMS or voice.
6. **System user token** with `whatsapp_business_messaging` scope. Permanent, not the temporary dev token.
7. **Webhook** on an HTTPS endpoint at glyco.fit, subscribed to `messages` status events.
8. **Templates** submitted for review, in Spanish, category `utility`.

Test messages to a few allowed numbers work before verification completes, so development isn't blocked — production sending is. The green tick (Official Business Account) is a separate later filing requiring notable public brand presence; not needed, don't wait for it.

**Cost estimate:** at ~1 message/day to ~100 intervention participants, roughly US$3–8/month in Meta fees; under US$50 for the whole six-month study. Cost is not a constraint here. No BSP means no platform fee.

---

## §7 Testing requirements

Don't chase coverage. These four must exist and must pass:

1. **Arm enforcement** — a control participant cannot receive an intervention message through *any* send path: scheduled, manual, retry, batch, admin-triggered. Include the case where a feature flag is wrongly enabled for the control arm.
2. **Auth boundaries** — doctor↔patient authorization on attachments, patient data, and every admin route.
3. **Thresholds** — glucose and BP status logic on web and mobile. They mirror each other and will drift.
4. **Scheduler** — rules fire when they should, never double-fire, respect San Juan time, and are idempotent on retry.

### Dress rehearsal — before any real patient is enrolled

Enrol five fake participants: some intervention, some control, one iPhone, one Android, one who withdraws mid-run. Let the scheduler run for a full week against them. Verify:

- every control participant received **nothing**
- every intervention message is in the log with delivery events
- the withdrawn participant stopped receiving messages at the right moment
- the export produces clean, reconcilable rows

This is the cheapest insurance in the plan. Do not skip it.

---

## §8 Open items

Blocked on other people. Don't guess at these — flag and move on.

1. **Message schedule detail** *(Alfredo)* — 1/day is the starting point. Which reminder type on which days, at what hour, and does frequency change over six months? Build the scheduler to take this as data.
2. **WhatsApp portfolio legal entity** *(Jc)* — must match verification documents; visible to patients. Needed before §6 step 1.
3. **Escalation policy** *(Alfredo)* — who is notified on an out-of-range reading, in what window, what the patient is told to expect. Blocks P2-10's policy values, not its mechanism.
4. **Primary endpoint and sample size** *(Alfredo and his director)* — outside the build, but the protocol currently lists five co-equal objectives and no power calculation. Worth raising before it goes to review.
5. **Consent and ethics annexes** — handled outside this project. The only build-relevant consequence: whatever it says about data access, retention, withdrawal and the WhatsApp channel must match what the system actually does. Ask before assuming.

---

## §9 Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-31 | Initial plan. Decisions settled: name GlycoFit, age ≥60, ~50/50 arms, flexible N, feature-flag-driven arm differences, admin panel, both channels split by type, Cloud API direct, template UI, APK then Play Store, iOS via PWA + WhatsApp. Meta onboarding started. |
| 1.1 | 2026-08-01 | Completed P0-1 (findAttachment existed), P0-2 (imports correct), P0-3 (doctor auth fix on attachments), P0-4 (Gemini timeout 30s + retry with backoff, model updated to gemini-3.5-flash), P0-7 (health endpoint + PM2 startup systemd), P0-9 (LATERAL joins in doctor patient list). Deployed attachment feature with Cloudinary + Gemini. Standardized all dates to DD/MM/YYYY with America/Argentina/San_Juan timezone. Removed ±24h idempotency check on completions. Added file upload to existing completions for both patient and doctor. Configured prod env vars (Cloudinary, Gemini). Ran attachment migration on prod. |
