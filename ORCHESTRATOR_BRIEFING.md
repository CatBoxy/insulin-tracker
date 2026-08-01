# Glycofit — Comprehensive Orchestrator Briefing

> Generated 2026-07-31. Two-repo project: web (Next.js) + mobile (React Native/Expo).

---

## 1. WHAT IS GLYCOFIT

A health tracking platform for type-2 diabetes patients (primarily elderly, Spanish-speaking, Argentine). Patients log glucose, blood pressure, and weight readings; track medical checkups (seguimiento medico); and share data with their doctors. Doctors monitor patients, manage prescriptions/appointments, and review AI-parsed lab results.

**Domain**: `glyco.fit` (previously "Nivelo", rebranded June 2026)
**Users**: Patients, doctors, admins
**Language**: Spanish (es-AR locale, `America/Argentina/San_Juan` timezone)

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────┐    ┌─────────────────┐
│  Web App (PWA)  │    │  Mobile App     │
│  Next.js 15     │    │  Expo SDK 54    │
│  Port 3008      │    │  React Native   │
└────────┬────────┘    └────────┬────────┘
         │                      │
         │   HTTPS (Bearer)     │
         └──────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │  Next.js API Routes │
         │  (Route Handlers)   │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Service Layer      │
         │  (16 service files) │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  PostgreSQL 16      │
         │  25 tables          │
         │  VPS: 5.161.182.202 │
         └─────────────────────┘

External Services:
- Resend (transactional email)
- Cloudinary (file storage) — not yet deployed
- Google Gemini 2.5 Flash (document parsing) — not yet deployed
```

### API-First Design
All mutations go through Next.js API route handlers → service layer → PostgreSQL. No direct DB calls from pages/components. This is intentional — the same API serves both web and mobile clients.

### Auth Flow
- **Web**: JWT in httpOnly cookie (7-day expiry)
- **Mobile**: JWT in Bearer header, stored in expo-secure-store
- Password hashing: bcrypt (10 rounds)
- Email verification: 48h token TTL
- Password reset: 15min token TTL, single-use

---

## 3. INFRASTRUCTURE

| Component | Details |
|-----------|---------|
| **VPS** | Hetzner `claude-bot` (5.161.182.202), Ubuntu 24.04, 4GB RAM, 75GB disk |
| **SSH** | Port 2222, user `deploy`, key `~/.ssh/id_ed25519_hetzner` |
| **Process Manager** | PM2 — glycofit on port 3008, cuyorental on 3009, lacalculadora on 3000 |
| **Reverse Proxy** | Nginx with Let's Encrypt SSL for glyco.fit |
| **Database** | PostgreSQL 16 on same VPS (localhost:5432), db `insulin_tracker` |
| **CI/CD** | GitHub Actions → SSH deploy on push to main. GitHub env "prod" |
| **Git Remote** | `git@github.com-catboxy:CatBoxy/insulin-tracker.git` (SSH alias required) |
| **Email** | Resend API |
| **Files** | Cloudinary (not yet configured in prod) |
| **AI** | Google Gemini 2.5 Flash (not yet configured in prod) |

### Deployment Pipeline
1. Push to `main` triggers `.github/workflows/deploy.yml`
2. `npm ci` → `npm run build` (standalone output)
3. Rsync `.next/standalone/`, `.next/static/`, `public/` to `/home/deploy/apps/glycofit/`
4. PM2 restart glycofit

### Critical Ops Rules
- **NEVER overwrite `.env` on VPS** — always read first, append/merge only (incident: lost all env vars during rename)
- **Email links must use `APP_URL`** (runtime), never `NEXT_PUBLIC_*` (build-time baked → localhost in prod)
- SSH config alias `claude-bot` handles host/port/key automatically

---

## 4. DATABASE SCHEMA (25 Tables)

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | Auth (email, password_hash, role, name, phone, email_verified) |
| `patients` | Profile (DOB, gender, height_cm, medical_history_completed) |
| `doctors` | Profile (unique 6-char code for QR linking) |
| `patient_doctor` | Many-to-many assignment (status: active) |

### Clinical Data
| Table | Purpose |
|-------|---------|
| `measurements` | Glucose, BP, weight (value, unit, context, recorded_at) |
| `measurement_reference_ranges` | Normal ranges for thresholds |
| `body_composition` | Adipose %, muscle % |
| `doctor_indices` | Calf circumference, dynamometer, chair test, insulin resistance |

### Checkup Tracking (Seguimiento Medico)
| Table | Purpose |
|-------|---------|
| `checkup_types` | 9 seeded types (diabetologist, lab, cardiologist, etc.) |
| `patient_checkups` | Per-patient tracking with frequency override, active flag |
| `checkup_completions` | Completion records with date, notes, who reported |
| `checkup_requests` | Patient→doctor order requests |
| `checkup_attachments` | Cloudinary file references (NEW, not deployed) |
| `checkup_parsed_results` | AI-parsed structured data from documents (NEW, not deployed) |

### Other
| Table | Purpose |
|-------|---------|
| `alerts` | Types: measurement_critical, missed_logging, medication_expiring, checkup_due |
| `appointments` | Doctor-patient scheduling (pending→confirmed→completed→cancelled) |
| `prescriptions` + `prescription_items` | Doctor-issued medications |
| `patient_family_history` | Family medical conditions |
| `patient_personal_history` | Personal medical conditions |
| `patient_medications` | Current medications list |
| `device_tokens` | Push notification tokens (infra only, no sender) |
| `email_verification_tokens` | 48h TTL |
| `password_reset_tokens` | 15min TTL, single-use |

### Key Trigger
`sync_patient_checkup_last_completed` — auto-updates `patient_checkups.last_completed_at` when completions are inserted/updated/deleted.

---

## 5. API SURFACE (~55 Routes)

### Auth (10 routes)
- Login, register, logout, me, account update, password change
- Email verification (verify, resend)
- Password reset (forgot, reset)

### Patient Data
- `GET/POST /api/measurements` — log/list readings
- `GET /api/measurements/[patientId]/chart` — chart data with reference ranges
- `GET /api/alerts` — unread alerts
- `PUT /api/alerts/dismiss/[id]` — dismiss
- `POST /api/alerts/check`, `check-refills`, `check-checkups` — background batch checks
- `GET/POST /api/appointments` — list/create
- `GET /api/medications/[patientId]` — prescriptions

### Checkups (Seguimiento)
- `GET /api/checkups` — patient's checkups with computed status
- `POST /api/checkups/[id]/complete` — mark complete (supports file upload via FormData)
- `POST /api/checkups/onboarding` — bulk initial setup
- `POST /api/checkups/[id]/request` — request order from doctor
- `GET /api/checkups/completions/[id]/attachments` — list attachments with parse status

### Doctor
- `GET /api/doctor/patients` — patient list sorted by vital status
- `GET /api/doctor/patients/[id]` — full patient detail
- `GET/PATCH /api/doctor/patient/[id]/checkups/[checkupId]` — view/modify checkups
- `POST /api/doctor/patient/[id]/checkups/[checkupId]/complete` — complete on behalf
- Body composition, indices, medical history, weights, height endpoints

### Admin
- User CRUD, doctor-patient assignment

### Linking
- QR generation, doctor lookup by code, patient-doctor linking

---

## 6. WEB APP (insulin-tracker)

**Stack**: Next.js 15.5.16, React 19, TypeScript, Tailwind CSS, Recharts, Zod, PWA
**Repo**: `/home/juan/Development/insulin-tracker`

### Key Conventions
- All pages are client components (`"use client"`) — fetch via `fetch()` to API routes
- No server actions, no ORM, no test infrastructure
- Service layer in `src/services/` — all SQL lives here
- Zod schemas in `src/lib/validation.ts` (single file)
- No icon library (inline SVGs), no modal library, no toast library, no date-fns
- Spanish UI with English code

### Current Git Status — UNCOMMITTED WORK
**File attachments + AI parsing feature** (partially complete):
- New files: `cloudinary.ts`, `gemini.ts`, `attachments.service.ts`, attachment API routes, migration
- Modified: checkup complete routes (FormData support), CheckupCard, doctor patient view
- New dependencies: `@google/generative-ai`, `cloudinary`
- Deployment guide: `DEPLOY_ATTACHMENTS.md`

### Bugs in Uncommitted Code (Must Fix Before Deploy)
1. **`findAttachment()` undefined** in `attachments.service.ts` — will cause runtime errors
2. **Wrong service imports** in `/api/attachments/[id]/route.ts` — references `appointmentsService` methods that don't exist there
3. **Missing doctor auth check** in `/api/checkups/completions/[id]/attachments` — any doctor can access any patient's attachments
4. **No retry/timeout** for Gemini parse failures — jobs stuck in "processing" forever

---

## 7. MOBILE APP (insulin-tracker-mobile)

**Stack**: Expo SDK 54, React Native 0.81.5, React 19, Expo Router 6, TypeScript, Zod
**Repo**: `/home/juan/Development/insulin-tracker-mobile`
**Bundle ID**: `com.glycofit.app`

### Structure
```
app/
├── (auth)/     — login, register, register-doctor
├── (patient)/  — dashboard, seguimiento (checkups), account, historia-clinica
├── (doctor)/   — patient list, patient detail (6 tabs), notifications, account
└── (admin)/    — stub (placeholder)

components/ui/  — Button, Card, Input, Badge, StatusDot, LoadingSpinner
lib/            — auth-context, api, types, constants, storage, theme, thresholds, validation
```

### Feature Parity with Web

| Feature | Web | Mobile |
|---------|-----|--------|
| Login/Register with doctor code | Yes | Yes |
| Glucose/BP measurement logging | Yes | Yes |
| Measurement charts | Yes | No (placeholder) |
| Alerts view/dismiss | Yes | Yes |
| Appointments view/confirm | Yes | Yes |
| Appointment creation (doctor) | Yes | Yes |
| Prescription view | Yes | Yes |
| Prescription creation (doctor) | Yes | No |
| Checkup tracking (seguimiento) | Yes | Yes |
| Checkup order requests | Yes | Yes |
| Medical history | Yes | Yes |
| Account/password management | Yes | Yes |
| QR code generation (doctor) | Yes | Yes |
| Doctor-patient linking | Yes | Yes |
| Body composition | Yes | No |
| Doctor indices | Yes | No |
| File attachments + AI parsing | In progress | No |
| PDF export | No | No |
| Push notifications | No | No |
| Admin panel | Yes | Stub |
| Email verification | Yes | No (handled via web) |
| Password reset | Yes | No (handled via web) |
| PWA install prompt | Yes | N/A |

### Mobile-Specific Issues
1. **No charts/graphs** — explicitly marked "proximamente"
2. **Silent error handling** — many `.catch(() => {})` blocks swallow errors
3. **20-hour measurement window** enforced client-side only (no server validation)
4. **Diastolic BP parsed from notes string** (`notes.match(/diastolic:(\d+)/)`) — fragile
5. **Large screen files** — patient dashboard and doctor patient detail are 600+ lines each
6. **No offline mode** — fully network-dependent
7. **No push notifications** — no setup at all
8. **Admin panel not implemented** — just a placeholder

---

## 8. WHAT'S BEEN BUILT (Completed)

- Full auth system (JWT, email verification, password reset, role-based access)
- Patient measurement logging with context-aware thresholds
- Alert system (measurement critical, missed logging, medication expiry, checkup due)
- Doctor-patient linking via QR codes
- Appointment scheduling with status lifecycle
- Prescription management
- Seguimiento Medico (9 checkup types, frequency tracking, completion history, doctor overrides)
- Medical history (family, personal, medications)
- Body composition + doctor clinical indices
- PWA with service worker
- CI/CD pipeline (GitHub Actions → VPS)
- Mobile app with ~85% feature parity

---

## 9. WHAT'S IN PROGRESS

### File Attachments + AI Parsing (uncommitted on web)
- Patients/doctors can attach files (lab results, imaging) to checkup completions
- Files uploaded to Cloudinary (`glycofit/checkups/` folder)
- Google Gemini 2.5 Flash parses documents into structured data (JSONB)
- **Status**: Code written but has bugs (see Section 6). Migration not run on prod. Cloudinary + Gemini API keys not configured on server.
- **Deploy steps**: documented in `DEPLOY_ATTACHMENTS.md`

---

## 10. WHAT'S NOT BUILT YET (Roadmap)

### High Priority
1. **Push notifications** — device token infra exists, no backend sender. Critical for appointment reminders and alert delivery.
2. **PDF data export** — patients need to share health summaries with external doctors
3. **Mobile charts** — no trend visualization in the mobile app

### Medium Priority
4. **Reminders system** — recurring measurement + personal reminders with cron trigger
5. **Mobile UI polish** — responsive audit at 320/375/414/768/1024
6. **Admin panel** (mobile) — user management not implemented

### From Partner Roadmap (2026-03-24 meeting)
7. **BP validation** — systolic must be > diastolic (reject otherwise)
8. **Alert margin review** — formalize thresholds with medical input
9. **Feedback messages** — show "todo OK" or warning after logging a value
10. **Patient self-registration flow** — onboard without admin
11. **Appointment scheduling** — default every 3 months
12. **Shareable patient report** — read-only URL for third parties

### Lower Priority
13. **Native Android app** — deferred; PWA + Expo approach is priority
14. **VPS dashboard app** — Astro-based server monitoring (separate repo)

---

## 11. QUALITY ASSESSMENT

### Strengths
- Clean API-first architecture (same backend serves web + mobile)
- Strong auth with multiple verification layers
- Good database design with proper constraints, indexes, and triggers
- Consistent service layer abstraction
- Comprehensive Zod validation on all inputs
- Well-documented (ROADMAP, CONVENTIONS, PROJECT_OVERVIEW, DEPLOY docs)

### Weaknesses
- **No tests** — zero test infrastructure in either repo
- **No error monitoring** — no Sentry, no structured logging
- **Inconsistent API response format** — some return `{ ok: true }`, others return data directly
- **N+1 queries** in `doctor.service.listPatients()` — 4 subqueries per patient
- **No pagination** on several endpoints (measurements pulls up to 1000 rows)
- **Silent error swallowing** in mobile app
- **Bugs in uncommitted attachment code** — must fix before deploying

### Security Notes
- All SQL is parameterized (no injection risk)
- httpOnly cookies prevent XSS token theft
- Role-based access enforced at route level
- Email verification + password reset with proper token expiry
- **Gap**: Missing doctor auth check in new attachment routes (uncommitted code)

---

## 12. KEY FILES REFERENCE

### Web App
| Path | Purpose |
|------|---------|
| `src/lib/auth-middleware.ts` | `getAuthUser()`, `requireAuth()` |
| `src/lib/patient-resolve.ts` | `resolvePatientId()` — maps user.id to patient.id |
| `src/lib/validation.ts` | All Zod schemas (single file) |
| `src/lib/thresholds.ts` | Glucose/BP threshold logic with context awareness |
| `src/middleware.ts` | JWT verification, role redirects, route guards |
| `src/db/pool.ts` | PostgreSQL connection pool |
| `src/services/*.service.ts` | 16 service files (all business logic) |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `next.config.js` | Standalone output mode |

### Mobile App
| Path | Purpose |
|------|---------|
| `lib/auth-context.tsx` | React Context for auth state + protected routing |
| `lib/api.ts` | Fetch wrapper with Bearer token, 401 handling |
| `lib/constants.ts` | `API_BASE_URL` from env (default: glyco.fit) |
| `lib/storage.ts` | Secure token persistence (expo-secure-store) |
| `lib/theme.ts` | Color palette, spacing, typography |
| `lib/thresholds.ts` | Glucose/BP status logic (mirrors web) |
| `lib/validation.ts` | Zod schemas (mirrors web) |
| `app.json` | Expo config, bundle ID, permissions |
| `eas.json` | Build profiles (dev, preview, production) |

---

## 13. OPERATIONAL NOTES

- **Server was down** when this briefing was created — glycofit was not in PM2. Fixed by starting it manually and saving PM2 state.
- **PM2 dump** now includes glycofit alongside cuyorental and lacalculadora.
- **Workflow**: Branch-per-feature when PRs are needed, but during active dev the owner pushes directly to main.
- **Migration runner**: `npm run migrate:up` (uses `node-pg-migrate`, migrations in `src/db/migrations/`)
- **The attachment migration has NOT been run on prod yet.**
