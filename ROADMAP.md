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

- [ ] Fix user.id vs patient_id mismatch in authorization checks:
  - [ ] `GET /api/alerts/[patientId]` — uses `user.id !== pid` instead of resolved patient_id
  - [ ] `GET /api/measurements/[patientId]` — same issue
  - [ ] `GET /api/measurements/[patientId]/chart` — same issue
  - [ ] `GET /api/medications/[patientId]` — same issue
- [ ] Add doctor-patient relationship validation to `PATCH /api/appointments/[id]`
- [ ] Fix `PATCH /api/alerts` — validate user owns the alerts before dismissing

### Zod Validation (MEDIUM)

- [ ] Add Zod schema for `POST /api/admin/assign` (doctor_user_id, patient_id)
- [ ] Add Zod schema for `POST /api/admin/users` (email, password, role, name)
- [ ] Add Zod schema for `POST /api/appointments` (patient_id, scheduled_at, duration, type, location, notes)
- [ ] Improve Zod schema for `POST /api/measurements` (replace manual validation)
- [ ] Add Zod schema for `PATCH /api/appointments/[id]` (status, scheduled_at, etc.)

### Error Handling (MEDIUM)

- [ ] Add try-catch to `POST/GET/DELETE /api/admin/assign`
- [ ] Add try-catch to `GET/POST /api/admin/users`
- [ ] Add try-catch to `GET/POST /api/appointments`
- [ ] Add try-catch to `GET /api/doctor/patients`
- [ ] Add try-catch to `GET /api/doctor/patients/[id]`
- [ ] Add try-catch to `GET /api/medications`

### SQL Safety (LOW)

- [ ] Refactor dynamic SQL field construction in `PATCH /api/appointments/[id]` to use parameterized approach

## Phase 3 — Feature Work

From partner meeting (2026-03-24) and ongoing requirements.

- [ ] Blood pressure validation rules (ranges, alerts)
- [ ] Alert system improvements (notifications, escalation)
- [ ] Appointment scheduling enhancements
- [ ] Data sharing between patient and doctor
- [ ] Android app (API consumption — depends on stable API layer)

---

*Last updated: 2026-05-09*
