# GlycoFit — Orchestrator Briefing

> Status as of 2026-08-05. Covers both repos: web (Next.js) and mobile (Expo/React Native).

---

## 1. WHAT WAS DONE (2026-08-01 through 2026-08-04)

### Session summary

In one continuous session across 4 days, we completed **Phase 0** (stabilization), **Phase 1** (study infrastructure), and **Phase 2** (messaging engine) of the GlycoFit agent plan — 30 tasks total. The mobile app was also updated for parity. Everything is deployed to production.

### By the numbers

| Metric | Value |
|--------|-------|
| Web source files | 144 TypeScript files |
| Web lines of code | ~15,000 |
| Mobile source files | 40 TypeScript files |
| Mobile lines of code | ~5,400 |
| Database tables | 40 (PostgreSQL 16) |
| Migrations applied | 19 |
| API routes | ~70 |
| Services | 20 service files |

---

## 2. PHASE STATUS

### Phase 0 — Stabilize (COMPLETE)

| Task | What | Status |
|------|------|--------|
| P0-1 | findAttachment | Done (already existed) |
| P0-2 | Service imports | Done (already correct) |
| P0-3 | Doctor auth fix on attachments | Done — was a silent patient-data exposure |
| P0-4 | Gemini timeout + retry | Done — 30s timeout, 3 attempts with backoff, model: gemini-3.5-flash |
| P0-5 | Commit + deploy attachments | Done — Cloudinary + Gemini keys on server, migration applied |
| P0-6 | Off-box backups | Done — nightly pg_dump to Backblaze B2, restore verified (40 tables pass) |
| P0-7 | Uptime + PM2 | Done — /api/health endpoint, PM2 startup systemd service |
| P0-8 | Sentry | Deferred |
| P0-9 | N+1 doctor query | Done — LATERAL joins, single query |
| P0-10 | Measurement pagination | Done — server-side, default 50/page, "Cargar más" UI |

### Phase 1 — Study Infrastructure (COMPLETE)

| Task | What | Status |
|------|------|--------|
| P1-1 | Study participants + arm audit | Done — 4 tables, service with enroll/withdraw/audit, opaque codes |
| P1-2 | Arm enforcement gate | Done — checkArmGate() reads DB at call time, logs every refusal |
| P1-3 | Feature flags by arm | Done — 6 flags seeded, per-arm settings, audit trail, isEnabled() resolver |
| P1-4 | BP schema fix | Done — systolic/diastolic columns, CHECK constraint, backfill, no more regex |
| P1-5 | Lab results + verification | Done — doctor review UI, analyte mapping, verified/unverified badges |
| P1-6 | Abdominal circumference | Done — on doctor_indices table |
| P1-7 | Interaction tracking | Done — last_interaction_at, app_sessions, 30min debounce |
| P1-8 | Measurement window | Done — server-side 20h enforcement, returns 429 |
| P1-9 | Enrollment screening | Done — admin UI, age ≥60 check, consent capture, screening log |
| P1-10 | Admin panel | Done — flags matrix, study dashboard, inactive patient alerts |

### Phase 2 — Messaging Engine (MOSTLY COMPLETE)

| Task | What | Status |
|------|------|--------|
| P2-1 | Messaging schema | Done — 5 tables (templates, rules, messages, events, channels) |
| P2-2 | Channel abstraction | Done — Channel interface, registry, unified sender |
| P2-3 | WhatsApp adapter | BLOCKED — waiting on Meta Business setup (Jc) |
| P2-4 | Push adapter | Done — Expo Push API, dead token detection |
| P2-5 | Scheduler | Done — cron/inactivity/appointment/checkup triggers, idempotent |
| P2-6 | Inactivity protocol | Done — 3-day rule, fire-once until patient interacts |
| P2-7 | Message telemetry | Done — lifecycle, engagement metrics, acted-upon linkage |
| P2-8 | Personalization | Done — variable substitution + Gemini with guardrails, fallback |
| P2-9 | Template authoring UI | Done — immutable versioning, doctor approval, WA status |
| P2-10 | Escalation path | BLOCKED — waiting on Alfredo for clinical policy. **Launch blocker.** |

### Phase 3 — Mobile (IN PROGRESS)

| Task | What | Status |
|------|------|--------|
| P3-1 | Signed APK | Ready — EAS config in place, needs `eas build` |
| P3-2 | Play Store listing | Needs P3-1 |
| P3-3 | Charts on mobile | Not started |
| P3-4 | Split oversized screens | Done — patient 668→245, doctor 660→291 lines |
| P3-5 | Push notification client | Done — expo-notifications, token registration on login |
| P3-6 | Accessibility pass | Not started |
| P3-7 | Onboarding guided practice | Not started |
| P3-8 | Parity gaps | Not started |

### Phase 4 — Analysis Support (NOT STARTED)

| Task | What |
|------|------|
| P4-1 | De-identified analysis export |
| P4-2 | Engagement metrics export |
| P4-3 | Patient PDF health summary |
| P4-4 | Shareable read-only patient report |

---

## 3. ARCHITECTURE (Current State)

```
┌─────────────────┐    ┌─────────────────┐
│  Web App (PWA)  │    │  Mobile App     │
│  Next.js 15     │    │  Expo SDK 54    │
│  15,000 LOC     │    │  5,400 LOC      │
│  Port 3008      │    │  com.glycofit   │
└────────┬────────┘    └────────┬────────┘
         │    HTTPS (Bearer)    │
         └──────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │  Next.js API Routes │
         │  ~70 endpoints      │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  Service Layer      │
         │  20 service files   │
         └──────────┬──────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼───┐     ┌─────▼─────┐  ┌─────▼─────┐
│ PG 16 │     │ Cloudinary│  │  Gemini   │
│40 tbls│     │  (files)  │  │ (AI parse)│
└───────┘     └───────────┘  └───────────┘

Messaging Engine:
┌──────────────────────────────────────────┐
│  Scheduler (cron/inactivity/appt/checkup)│
│         ↓                                │
│  Arm Gate (DB read, refusal log)         │
│         ↓                                │
│  Personalizer (Gemini + guardrails)      │
│         ↓                                │
│  Channel Registry → Push Adapter (Expo)  │
│                   → WhatsApp (pending)   │
│         ↓                                │
│  Message Log + Event Tracking            │
│         ↓                                │
│  Telemetry (acted-upon, weekly metrics)  │
└──────────────────────────────────────────┘
```

### Infrastructure
- **VPS**: Hetzner 5.161.182.202, Ubuntu 24.04, 4GB RAM
- **PM2**: glycofit (3008), cuyorental (3009), lacalculadora (3000), auto-restart on reboot
- **Nginx**: Let's Encrypt SSL for glyco.fit
- **Backups**: Nightly pg_dump → Backblaze B2, 30 daily + monthly retention, restore verified
- **CI/CD**: GitHub Actions → SSH deploy on push to main
- **Health**: /api/health endpoint (DB connectivity check)

### Database — 40 Tables
**Core**: users, patients, doctors, patient_doctor
**Clinical**: measurements (with systolic/diastolic), alerts, appointments, prescriptions, prescription_items, body_composition, doctor_indices (with abdominal_circumference)
**Checkups**: checkup_types, patient_checkups, checkup_completions, checkup_requests, checkup_attachments, checkup_parsed_results
**Medical History**: patient_family_history, patient_personal_history, patient_medications
**Lab Results**: lab_results (with doctor verification)
**Study**: study_participants, study_arm_audit, study_screening_log, study_incidents
**Messaging**: message_templates, message_schedule_rules, messages, message_events, patient_channels, message_send_refusals
**Features**: feature_flags, feature_flag_arm_settings, feature_flag_audit
**Auth**: email_verification_tokens, password_reset_tokens, device_tokens
**Tracking**: app_sessions
**Other**: measurement_reference_ranges, pgmigrations

---

## 4. WHAT'S BLOCKING LAUNCH

### Must resolve before first enrollment

1. **P2-10 Escalation policy** (blocked on Alfredo) — who gets notified on out-of-range readings, in what window, what the patient sees. **The mechanism can be built anytime; the policy is a clinical decision.** Raise in next meeting.

2. **P2-3 WhatsApp adapter** (blocked on Jc's Meta setup) — Meta Business verification, WABA, phone number, system user token. Dev can proceed with push-only, but WhatsApp is the primary intervention channel.

3. **Dress rehearsal** (§7 of the plan) — 5 fake participants, scheduler running for a week, verify: control gets nothing, intervention gets messages, withdrawn stops, export reconciles.

### Should do before enrollment

4. **P3-1 Signed APK** — ready to build, just needs `eas build`
5. **P3-3 Charts on mobile** — patients need trend visualization
6. **P3-6 Accessibility pass** — elderly cohort, large text, high contrast, 44px tap targets
7. **P3-7 Onboarding** — guided first-run experience

### Nice to have

8. P0-8 Sentry (error monitoring)
9. P3-2 Play Store listing
10. Phase 4 analysis exports

---

## 5. OPEN ITEMS (from §8 of the plan)

1. **Message schedule detail** (Alfredo) — 1/day is the starting point. Which type on which days, at what hour?
2. **WhatsApp portfolio legal entity** (Jc) — must match verification documents
3. **Escalation policy** (Alfredo) — notification rules for out-of-range readings
4. **Primary endpoint and sample size** (Alfredo + director) — worth raising before ethics review
5. **Consent and ethics annexes** — data access, retention, withdrawal must match system behavior

---

## 6. KEY FILES REFERENCE

### Web App (`/home/juan/Development/insulin-tracker`)
| Path | Purpose |
|------|---------|
| `GLYCOFIT_AGENT_PLAN.md` | Living task plan with changelog |
| `src/services/messaging/` | Full messaging engine (sender, scheduler, push, personalize, events, registry) |
| `src/services/messaging.service.ts` | Arm enforcement gate (checkArmGate) |
| `src/services/study.service.ts` | Enrollment, arm changes, screening, incidents |
| `src/services/features.service.ts` | Feature flags resolver + admin |
| `src/services/templates.service.ts` | Template versioning + approval |
| `src/services/telemetry.service.ts` | Message lifecycle + engagement metrics |
| `src/services/labs.service.ts` | Lab results + doctor verification |
| `src/services/attachments.service.ts` | File upload + Gemini AI parsing |
| `src/app/admin/page.tsx` | Admin panel (Usuarios, Estudio with dashboard/flags/telemetry, Mensajes) |

### Mobile App (`/home/juan/Development/insulin-tracker-mobile`)
| Path | Purpose |
|------|---------|
| `lib/notifications.ts` | Push notification setup + token registration |
| `lib/auth-context.tsx` | Auth state + push registration on login |
| `components/patient/` | 5 extracted components (form, measurements, alerts, appointments, medications) |
| `components/doctor/` | 6 extracted components (vitals, alerts, prescriptions, appointments, checkups, history) |

---

## 7. OPERATIONAL NOTES

- **Backups**: nightly at 03:00 Argentina, verified restore passes on all 40 tables
- **PM2 startup**: systemd service installed, auto-restores on reboot
- **DB access**: port 5432 restricted to Jc's ISP subnet (45.175.103.0/24) via UFW + pg_hba
- **Env vars on prod**: DATABASE_URL, JWT_SECRET, COOKIE_SECURE, RESEND_API_KEY, EMAIL_FROM, APP_URL, CLOUDINARY_CLOUD_NAME/KEY/SECRET, GEMINI_API_KEY
- **Migration tracking**: node-pg-migrate, some early migrations were manually applied — tracking table is now in sync
- **Date convention**: all dates DD/MM/YYYY, stored UTC, displayed in America/Argentina/San_Juan
- **NEVER overwrite .env on VPS** — append/merge only
