# Nivelo — Insulin & Health Tracker Overview

## Tech Stack
- **Next.js 14** (App Router) + **TypeScript** + **React 18**
- **PostgreSQL** (self-hosted on VPS) with `node-pg-migrate` for migrations
- **JWT auth** (jose + bcrypt) via httpOnly cookies
- **Tailwind CSS** for styling, **Recharts** for charts
- **Zod** for validation, **PWA** with service worker
- Spanish-language UI (es-AR locale)

## Roles & Access Model

Three roles: **patient**, **doctor**, **admin**

- **Patients** log their own glucemia (with context: fasting/postprandial/pre-dinner), blood pressure, view charts, receive alerts, see medications and appointments
- **Doctors** see assigned patients' data, manage prescriptions, create appointments, get a unique code + QR for patient linking
- **Admins** create users and manage patient-doctor assignments

**Linking flow**: Doctor gets a unique code → shares via QR or text → patient registers with code (or links later) → `patient_doctor` junction record created

## Database Schema (10 tables)

| Table | Purpose |
|---|---|
| `users` | Accounts (email, password_hash, role, name, phone) |
| `patients` | Patient profile (DOB, gender) → FK to users |
| `doctors` | Doctor profile (unique code for linking) → FK to users |
| `patient_doctor` | Many-to-many assignment (status: active) |
| `measurements` | Glucemia, blood_pressure, weight readings (value, unit, context, recorded_at) |
| `measurement_reference_ranges` | Normal ranges (glucose 70-140, BP 90-120/60-80) |
| `alerts` | Notifications (measurement_critical, missed_logging, medication_expiring, custom) with severity |
| `appointments` | Doctor-patient appointments (type: in_person/virtual/phone, status lifecycle) |
| `prescriptions` | Doctor-issued prescriptions with status and expiry |
| `prescription_items` | Line items (medication_name, dosage, frequency, instructions) |
| `device_tokens` | Push notification tokens (infrastructure ready, no backend yet) |

## Pages & Routes

**Public**: `/login`, `/register`, `/register/doctor`

**Patient**: `/dashboard` (log readings, view charts, alerts, medications, appointments, link to doctor), `/account` (profile, password, linked doctors)

**Doctor**: `/doctor` (patient list sorted by vital status, QR code), `/doctor/patient/[id]` (vitals charts, measurement history, alerts, prescriptions, appointments management)

**Admin**: `/admin` (create users, manage assignments)

## API Routes

- **Auth**: login (rate-limited 5/15min), register (rate-limited 3/hr), me, account PATCH, change-password, logout
- **Measurements**: GET/POST for patient, chart data endpoint with reference ranges
- **Alerts**: list unread, dismiss, batch-check for inactivity/critical/refill alerts
- **Medications**: CRUD for doctor, list for patient
- **Appointments**: CRUD with status lifecycle (pending→confirmed→completed/cancelled)
- **Doctor**: patient list with latest vitals, patient detail, QR generation
- **Admin**: user CRUD, assignment CRUD

## Alert System

- **Glucose**: warning >140 or <70, critical at 180/200, emergency >300 (postprandial-aware)
- **Blood Pressure**: warning ≥130/80, critical >140/90
- **Inactivity**: no glucose logged for 7+ days
- **Medication expiry**: prescription expires within 7 days
- **Escalation**: unread critical alerts after 30 days

## Middleware

- JWT verification on all non-public routes
- Role-based redirects (`/` → role-appropriate dashboard)
- Admin-only and doctor-only route guards (403)
- Proxy-friendly header handling

## PWA

- Service worker with network-first + cache fallback strategy
- Web manifest for standalone app mode (green theme)
- Platform-aware install prompt (Android, iOS, desktop)
- Offline fallback to home page

## Architecture Patterns

- Service layer (`src/services/`) for business logic and DB queries
- Zod validation on both client (inline field errors) and server
- No external APIs — fully self-contained
- GitHub Actions CI/CD deploys to VPS on push to main via SSH

## What's NOT built yet

- Push notifications (device token infra exists, no backend sender)
- Email/SMS notifications
- OAuth/SSO
- Weight tracking UI (schema supports it)
- Android native app (on roadmap)
