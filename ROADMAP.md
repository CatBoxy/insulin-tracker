# Roadmap

Work log and feature tracker for Nivelo. Check items off as they are completed.

---

## Phase 0 — Infrastructure & DevOps

- [x] Set up CI/CD: merge to main → auto-deploy to production server (GitHub Actions + SSH)
- [x] Set up migration system with version tracking (node-pg-migrate)
- [ ] Create VPS dashboard app (Astro, separate repo) — central hub to monitor all server projects
  - [ ] System status overview (CPU, memory, disk, uptime)
  - [ ] Per-project tabs with status, links, logs
  - [ ] Env variable management per project
  - [ ] Redeploy trigger per project
- [ ] Remove old vps-console from server

## Phase 1 — Service Layer Refactor

Extract all direct DB queries from route handlers into service files. No route handler should import `pool` or run SQL directly.

- [x] Create `src/services/auth.service.ts` — login, register, user lookup
- [x] Create `src/services/measurements.service.ts` — CRUD, chart data, pagination
- [x] Create `src/services/alerts.service.ts` — list, dismiss, check, batch operations
- [x] Create `src/services/appointments.service.ts` — CRUD, upcoming filter
- [x] Create `src/services/medications.service.ts` — list prescriptions
- [x] Create `src/services/admin.service.ts` — user management, doctor-patient assignments
- [x] Create `src/services/doctor.service.ts` — patient list, patient detail aggregation
- [x] Create `src/services/device-tokens.service.ts` — register/unregister tokens
- [x] Refactor all route handlers to use service layer (thin controllers)

## Phase 2 — Security & Validation Fixes

Issues found during initial audit (2026-05-09).

### Authorization Fixes (HIGH)

- [x] Fix user.id vs patient_id mismatch in authorization checks:
  - [x] `GET /api/alerts/[patientId]` — now uses resolvePatientId + doctor access check
  - [x] `GET /api/measurements/[patientId]` — same fix
  - [x] `GET /api/measurements/[patientId]/chart` — same fix
  - [x] `GET /api/medications/[patientId]` — same fix
- [x] Add doctor-patient relationship validation to `PATCH /api/appointments/[id]`
- [x] Fix `PUT /api/alerts/dismiss/[id]` — uses resolvePatientId for patient ownership check

### Zod Validation (MEDIUM)

- [x] Add Zod schema for `POST /api/admin/assign` (assignPatientSchema)
- [x] Add Zod schema for `POST /api/admin/users` (createUserSchema)
- [x] Add Zod schema for `POST /api/appointments` (createAppointmentSchema)
- [x] Zod schema for `POST /api/measurements` (measurementSchema — done in Phase 1)
- [x] Add Zod schema for `PATCH /api/appointments/[id]` (updateAppointmentSchema)

### Error Handling (MEDIUM)

- [x] All routes now have try-catch (done in Phase 1 refactor)

### SQL Safety (LOW)

- [x] Refactor dynamic SQL in appointments update to use explicit column map

## Phase 3 — Feature Work

### 3.1 Glucose Measurement Context

Add context to glucose measurements so thresholds adjust based on when it was taken.

**Options** (radio/checkbox on measurement form):
- En ayunas (fasting)
- 2hs después de almuerzo (postprandial)
- Antes de cenar (pre-dinner, uses fasting thresholds)

**Threshold rules** (from medical guidance):
- Fasting / pre-dinner: warning >140, critical >180, emergency >200
- Postprandial: warning >180, critical >250, emergency >300
- Emergency thresholds trigger urgent alert messages

**Implementation:**
- [x] Migration: add `context` column to measurements table
- [x] Update measurement form UI with context selection (radio buttons, required for glucemia)
- [x] Update Zod measurementSchema with context field
- [x] Update thresholds.ts with context-aware glucose ranges + emergency level
- [x] Update alerts.ts to use context-aware thresholds with urgent messages
- [x] Update measurement service create method
- [x] Show context label in measurement history list
- [x] Add emergency status to doctor views (statusBadge, sort order)

### 3.2 Web Push Notifications

Push notifications via browser Web Push API for patient reminders.

**Use cases:**
- Appointment reminders (e.g., 1 day before, 1 hour before)
- Measurement reminders (e.g., "Registrá tu glucemia en ayunas")

**Implementation:**
- [ ] Generate VAPID keys for web push
- [ ] Add web-push npm package
- [ ] Update service worker to handle push events and show notifications
- [ ] Create notification service (server-side) for sending push messages
- [ ] API endpoint to subscribe/manage push preferences
- [ ] Integrate with reminders system (3.3)

### 3.3 Reminders

A reminders feature for patients to set up measurement and personal reminders.

**Features:**
- Single reminders (one-time, date + time)
- Recurring reminders (daily, weekly, custom frequency)
- Types: measurement reminder, appointment reminder, custom
- Patient manages their own reminders from dashboard

**Implementation:**
- [ ] Migration: create `reminders` table (patient_id, type, title, message, frequency, next_trigger_at, active)
- [ ] Create reminders service
- [ ] API routes: CRUD for reminders
- [ ] Reminders UI section in patient dashboard
- [ ] Background job / cron to trigger reminders and send push notifications

### 3.4 QR-Based Doctor-Patient Linking

Doctors generate a QR code. Patients scan it to register (or link if already registered) and auto-link to that doctor. No admin intervention needed.

**Flow — new patient:**
1. Doctor opens QR from their dashboard
2. QR links to `https://<app>/register?doctor=<DOCTOR_CODE>`
3. Patient scans → PWA install prompt + registration page
4. Patient registers → auto-linked to doctor (patient_doctor created)

**Flow — existing patient:**
1. Patient scans QR → app detects they're logged in
2. Prompt: "Vincularte con Dr. [Name]?"
3. Confirm → auto-link created

**Doctor code:** permanent, one per doctor (stored in doctors table).

**Implementation:**
- [ ] Migration: add `code` column to doctors table (unique, generated on doctor creation)
- [ ] Generate doctor codes for existing doctors
- [ ] API endpoint: `GET /api/doctors/qr` — returns QR image for authenticated doctor
- [ ] API endpoint: `GET /api/doctors/by-code/[code]` — public, returns doctor name (for confirmation)
- [ ] Update register flow to accept `doctor` query param and auto-link
- [ ] Logged-in patient flow: detect doctor param, show confirmation, create link
- [ ] Doctor dashboard: "Mi código QR" button/section
- [ ] QR generation library (e.g., qrcode package)

### 3.5 Patient Data Export (PDF)

Patients can generate a PDF with their health data to share with any professional.

**PDF contents:**
- Patient info (name, DOB)
- Measurement history (glucemia, BP, weight) with charts
- Active prescriptions
- Alert history
- Date range filter

**Implementation:**
- [ ] Add PDF generation library (e.g., @react-pdf/renderer or pdfkit)
- [ ] Create PDF template with patient data layout
- [ ] API endpoint: `GET /api/patient/export` — generates and returns PDF
- [ ] UI: "Exportar mis datos" button in patient dashboard
- [ ] Date range selector for export scope

### 3.6 Mobile UI Polish

Review and fix responsive layout issues (overflow, spacing, placement).

- [ ] Audit all pages on mobile viewport (375px, 390px widths)
- [ ] Fix any overflow or spacing issues found
- [ ] Ensure touch targets are adequate (min 44px)
- [ ] Test PWA standalone mode layout

### 3.7 Android App (deferred)

PWA + QR approach is priority. Native Android app will be considered after PWA is stable and feature-complete. API-first architecture ensures the same backend serves both.

---

*Last updated: 2026-05-09*
