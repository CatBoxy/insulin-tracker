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

From partner meeting (2026-03-24) and ongoing requirements.

- [ ] Blood pressure validation rules (ranges, alerts)
- [ ] Alert system improvements (notifications, escalation)
- [ ] Appointment scheduling enhancements
- [ ] Data sharing between patient and doctor
- [ ] Android app (API consumption — depends on stable API layer)

---

*Last updated: 2026-05-09*
