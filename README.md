# CareRoute 🏥

> Deterministic clinical triage, specialist routing, on-device prescription OCR, and appointment booking — built for the Indian healthcare market.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Express-TypeScript-green?logo=express)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![TFLite](https://img.shields.io/badge/TFLite-WebGL-orange?logo=tensorflow)](https://ai.google.dev/edge/litert)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?logo=bun)](https://bun.sh)

---

## What is CareRoute?

CareRoute triages a patient's symptoms through a deterministic Six-Engine clinical pipeline (Manchester Triage / ESI inspired), normalises Hinglish/Hindi input via a lookup layer, routes them to the right specialist, lets them upload prescriptions for on-device Donut Vision OCR, books a real appointment slot, fires a Telegram alert on emergencies, shows the nearest ER on a live map, sends 24-hour follow-up reminders, and gives clinicians a live SSE-powered dashboard to manage their queue.

---

## Architecture

```mermaid
graph TB
    subgraph Client["Frontend — Next.js 16 (port 3000)"]
        A[Landing Page / Auth]
        B[Patient: Triage Wizard]
        C[Patient: Dashboard]
        D[Patient: Appointments]
        E[Patient: Profile + Dependents]
        F[Clinician: Live Queue]
        G[Admin: Panel]
        H[Timeline: Symptom History]
    end

    subgraph Pipeline["Triage Pipeline — Next.js /api/triage"]
        P1[IndicNormalizer]
        P2[emergencyPreCheck]
        P3[SafetyEngine]
        P4[OodEngine]
        P5[ClinicalRuleEngine]
        P6[matchSpecialty]
    end

    subgraph Backend["Backend — Express + TypeScript (port 4000)"]
        I[Auth Routes]
        J[Triage Routes + SSE]
        K[Profile Routes]
        L[Documents Routes]
        M[Maps Routes]
        N[Appointments Routes]
        O[Admin Routes]
        P[Dependents Routes]
        Q[Follow-up + Slot Scheduler]
    end

    subgraph Services["External Services"]
        R[(Supabase PostgreSQL)]
        S[Supabase Storage]
        U[Overpass API — OpenStreetMap]
        V[Telegram Bot API]
    end

    subgraph OnDevice["On-Device (Browser — WebGL)"]
        OD1[Donut TFLite Model]
        OD2[Autoregressive Decode Loop]
        OD3[tokenizer.json vocab]
    end

    A -->|JWT| I
    B -->|POST /api/triage| P1
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P4 --> P5
    P5 --> P6
    P6 -->|Triage result| B
    B -->|POST /api/triage/save| J
    J -->|Red/Emergency| V
    J -->|SSE broadcast| F
    B -->|GET /api/maps/nearest-er| M
    M -->|Overpass QL query| U
    C -->|GET /api/documents| L
    L -->|Upload/Download| S
    D -->|GET /api/doctors| N
    D -->|POST /api/appointments| N
    G -->|GET /api/admin/stats| O
    Q -->|24h Telegram reminder + daily slot generation| V
    I & J & K & L & M & N & O & P -->|SQL| R
    B -->|Prescription image| OD1
    OD1 --> OD2
    OD2 --> OD3
    OD3 -->|Drug names| B
```

---

## Data Flow — Triage

```mermaid
sequenceDiagram
    participant P as Patient
    participant FE as "Frontend (Next.js)"
    participant NX as "Next.js /api/triage"
    participant BE as "Express Backend"
    participant TG as Telegram

    P->>FE: Describes symptoms (voice or text, Hindi/Hinglish/English)
    FE->>NX: POST /api/triage {text, vitals, flags, dependent?, Authorization}
    NX->>NX: IndicNormalizer — normalise Hinglish to English clinical terms
    NX->>NX: emergencyPreCheck — deterministic keyword + flag check
    alt Emergency detected
        NX-->>FE: {severity: Red, emergency: true}
    else Not emergency
        NX->>NX: SafetyEngine — plausibility + vital collapse + red flag check
        NX->>NX: OodEngine — out-of-distribution detection
        NX->>NX: ClinicalRuleEngine — Manchester/ESI rule tree
        NX->>NX: matchSpecialty — keyword → specialty routing
        NX-->>FE: Full triage result + DecisionRecord
    end
    FE->>BE: POST /api/triage/save {result, symptom_text, for_dependent_id?}
    BE->>BE: Verify dependent ownership, persist triage_cases
    alt Red or Amber
        BE->>TG: sendEmergencyAlert() [non-blocking]
        BE->>BE: scheduleFollowUp() → follow_ups table
    end
    BE->>FE: SSE broadcast to clinician queue
    FE->>P: Result + reasoning + specialist cards + ER map (if Red)
```



---

## User Flows

### Patient
```
/ (Landing)
  └── Sign Up / Sign In
        └── /patient — Triage Wizard
              ├── Step 1: Describe symptoms (free text or 🎤 voice, Hindi/Hinglish/English)
              │          + "For whom?" selector (myself / dependent)
              ├── Step 2: Vitals (HR, SpO₂, temp, BP) + symptom flags + duration
              │          + Prescription upload → on-device Donut OCR → drug names extracted
              └── Step 3: AI Result
                    ├── GREEN  → Reassurance + self-care advice
                    ├── AMBER  → Specialist recommendation + Book appointment
                    └── RED    → 🚨 Emergency banner + Call 112 + Nearest ER map + Book appointment

/dashboard
  ├── Assessment history (paginated, filterable, from DB — localStorage fallback for guests)
  └── Document uploads (PDF/JPEG/PNG → Supabase Storage, signed URLs)

/timeline
  └── Symptom progression timeline — vertical list of past cases with severity indicators

/appointments
  ├── Upcoming appointments (with cancel)
  └── Past appointments

/profile
  └── Name, DOB, gender, phone → saved to DB
      └── Dependent Profiles — add/remove family members for caregiver triage
```

### Clinician
```
Sign in (role: doctor)
  └── /clinician
        ├── Live patient queue via SSE (push updates on new case, ?since= gap recovery on reconnect)
        ├── Red cases bubble to top, sorted by severity then time
        ├── Review button → marks case reviewed
        └── Note button → saves clinical note inline
```

### Admin
```
Sign in (role: admin)
  └── /admin
        ├── Stats — total cases, red/amber/green breakdown, total registered users
        ├── User management — list, change role, delete (with Supabase Storage cleanup)
        └── Audit log — all profile changes, role updates, deletions
```

### Emergency Path (automatic)
```
Red or Emergency triage result
  → Telegram alert fires to clinical team (non-blocking, concurrent with response)
  → 24-hour follow-up scheduled in follow_ups table
  → Hourly scheduler sends Telegram check-in reminder at T+24h (batch loop, no LIMIT)
  → Daily slot regeneration at 2AM keeps doctor availability current
  → Patient sees Leaflet map with nearest hospitals (Overpass API)
  → Each hospital has: name, distance, ER badge, phone, Google Maps directions
```

---

## The Six-Engine Clinical Pipeline

All triage logic runs server-side in the Next.js API route (`/api/triage`). No external AI calls. Fully deterministic and interpretable.

```
Input text (any language)
    ↓
[1] IndicNormalizer          — 35 Hinglish→English clinical mappings (append-not-replace)
    ↓
[2] emergencyPreCheck        — Deterministic keyword + boolean flag check (V1 safety net)
    ↓ (if not triggered)
[3] SafetyEngine             — Physiological plausibility + vital collapse + all 5 red flags
    ↓ (if PROCEED_TO_OOD)
[4] OodEngine                — Semantic + tabular out-of-distribution detection
    ↓ (if PROCEED_TO_ML)
[5] ClinicalRuleEngine       — Manchester/ESI inspired rule tree (text patterns + vitals + demographics)
    ↓
[6] matchSpecialty           — Deterministic keyword → specialty lookup table
    ↓
DecisionRecord (CDSCO-compliant audit record)
```

**Why deterministic instead of LLM?** In a CDSCO-regulated clinical environment, black-box ML models require months of shadow testing before deployment. Every decision in this pipeline is fully traceable to a named rule (`RED_FLAG_STROKE`, `VITAL_SPO2_COLLAPSE`, etc.) and logged in the `decision_record` JSONB field.



---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), Tailwind CSS |
| **Backend** | Express 4, TypeScript, Bun runtime |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | JWT (bcrypt, 7-day tokens, max 128-char passwords) |
| **AI — Triage** | Deterministic Six-Engine Pipeline (Manchester/ESI, no LLM) |
| **AI — OCR** | Donut Vision Transformer (~1 GB TFLite, WebGL, autoregressive decode + Tata 1mg fuzzy corrector) |
| **Storage** | Supabase Storage (documents, auto-bucket on startup) |
| **Maps** | Leaflet + react-leaflet, OpenStreetMap tiles, Overpass API |
| **Alerts** | Telegram Bot API (native fetch, non-blocking) |
| **Real-time** | Server-Sent Events (SSE) — clinician queue push + reconnect gap recovery |
| **Voice** | Web Speech API — `en-IN` locale (Hindi + English) |
| **Runtime** | Bun (frontend + Next.js); backend dev uses nodemon + ts-node |

---

## Database Schema

```mermaid
erDiagram
    users {
        UUID id PK
        TEXT email
        TEXT password_hash
        TEXT role
        TIMESTAMPTZ created_at
    }
    patients {
        UUID id PK
        UUID user_id FK
        TEXT name
        DATE date_of_birth
        TEXT gender
        TEXT phone
        TIMESTAMPTZ created_at
    }
    dependents {
        UUID id PK
        UUID user_id FK
        TEXT name
        DATE date_of_birth
        TEXT gender
        TEXT relationship
        TIMESTAMPTZ created_at
    }
    doctors {
        UUID id PK
        UUID user_id FK
        TEXT name
        TEXT specialty
        TEXT location
        TEXT contact
        TEXT bio
        INT experience_yrs
        INT fee_inr
        NUMERIC rating
        BOOL available
    }
    triage_cases {
        UUID id PK
        UUID patient_id FK
        UUID for_dependent_id FK
        TEXT for_name
        TEXT symptom_text
        TEXT severity
        BOOL emergency
        TEXT condition_guess
        TEXT summary
        TEXT recommended_specialty
        TEXT specialty_reason
        TEXT advice
        JSONB reasoning
        JSONB red_flags
        INT confidence
        JSONB decision_record
        BOOL reviewed
        TEXT clinician_note
        TIMESTAMPTZ created_at
    }
    follow_ups {
        UUID id PK
        UUID triage_case_id FK
        UUID patient_id FK
        TIMESTAMPTZ due_at
        BOOL sent
        TIMESTAMPTZ sent_at
    }
    documents {
        UUID id PK
        UUID patient_id FK
        UUID triage_case_id FK
        TEXT file_name
        TEXT storage_path
        TEXT mime_type
        TIMESTAMPTZ created_at
    }
    doctor_slots {
        UUID id PK
        UUID doctor_id FK
        TIMESTAMPTZ starts_at
        BOOL is_booked
    }
    appointments {
        UUID id PK
        UUID patient_id FK
        UUID doctor_id FK
        UUID slot_id FK
        UUID triage_case_id FK
        TEXT status
        TIMESTAMPTZ created_at
    }
    audit_log {
        UUID id PK
        UUID user_id FK
        TEXT action
        TEXT entity_type
        UUID entity_id
        JSONB payload
        TIMESTAMPTZ created_at
    }

    users ||--o{ patients : "has"
    users ||--o{ doctors : "may link"
    users ||--o{ dependents : "manages"
    patients ||--o{ triage_cases : "submits"
    dependents ||--o{ triage_cases : "triaged via"
    patients ||--o{ documents : "uploads"
    patients ||--o{ appointments : "books"
    patients ||--o{ follow_ups : "receives"
    doctors ||--o{ doctor_slots : "has"
    doctor_slots ||--o| appointments : "booked via"
    triage_cases ||--o{ documents : "attached to"
    triage_cases ||--o{ appointments : "triggers"
    triage_cases ||--o{ follow_ups : "schedules"
```

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register (`role: patient` or `doctor`) |
| POST | `/api/auth/signin` | — | Login, returns JWT |

### Patient
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | ✅ | Get profile (name, DOB, gender, phone) |
| PATCH | `/api/profile` | ✅ | Update profile fields (auto-creates row if missing) |
| GET | `/api/dependents` | ✅ | List dependents |
| POST | `/api/dependents` | ✅ | Add dependent |
| PATCH | `/api/dependents/:id` | ✅ | Update dependent (atomic ownership check) |
| DELETE | `/api/dependents/:id` | ✅ | Remove dependent |
| POST | `/api/triage/save` | ✅ | Validate + save triage result, fire alerts |
| GET | `/api/triage/history` | ✅ | Paginated triage history (`?limit=&offset=`) |
| POST | `/api/documents/upload` | ✅ | Upload document to Supabase Storage |
| GET | `/api/documents` | ✅ | List patient's documents (signed URLs) |
| DELETE | `/api/documents/:id` | ✅ | Delete document |
| GET | `/api/doctors?specialty=` | — | List doctors (filtered by specialty) |
| GET | `/api/doctors/:id/slots` | — | Available 30-min slots (next 7 days) |
| POST | `/api/appointments` | ✅ | Book a slot (race-safe `SELECT FOR UPDATE`) |
| GET | `/api/appointments` | ✅ | Patient's appointments |
| PATCH | `/api/appointments/:id/cancel` | ✅ | Cancel + release slot |

### Clinician
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/triage/queue/ticket` | ✅ doctor | Get single-use SSE auth ticket (30s TTL) |
| GET | `/api/triage/queue` | ✅ doctor | All patient triage cases (`?since=` for gap recovery) |
| GET | `/api/triage/queue/stream` | ticket | SSE stream — push on new case, 30s heartbeat |
| PATCH | `/api/triage/:id/review` | ✅ doctor | Mark case reviewed |
| PATCH | `/api/triage/:id/note` | ✅ doctor | Save clinical note |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | ✅ admin | Case counts by severity, total registered users |
| GET | `/api/admin/triage/recent` | ✅ admin | Recent Red/emergency cases |
| GET | `/api/admin/users` | ✅ admin | User list with search + pagination |
| PATCH | `/api/admin/users/:id/role` | ✅ admin | Change user role |
| DELETE | `/api/admin/users/:id` | ✅ admin | Delete user + storage cleanup |
| GET | `/api/admin/audit` | ✅ admin | Audit log with action filter |
| GET | `/api/admin/compliance/decisions` | ✅ admin | CDSCO DecisionRecord audit trail |

### Next.js API Routes (frontend server)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/triage` | Six-Engine triage pipeline (IndicNormalizer → SafetyEngine → OodEngine → ClinicalRuleEngine) |

### Utility
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/maps/nearest-er?lat=&lng=` | — | Nearby hospitals via Overpass API |
| GET | `/api/health` | — | Backend health check |



---

## Running Locally

### Prerequisites
- [Bun](https://bun.sh) installed
- Supabase project (free tier works)
- Telegram Bot token (optional — disables alerts + follow-ups if absent)

### Setup

```bash
# 1. Clone
git clone https://github.com/your-username/CareRoute.git
cd CareRoute

# 2. Install dependencies
bun install
cd backend && bun install && cd ..

# 3. Copy env and fill in your keys
cp .env.local.example .env.local
```

Fill in `.env.local`:
```env
# Database
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key

# Auth
JWT_SECRET=any-long-random-string-min-32-chars

# Backend URL (for Next.js server → Express calls)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# CORS (backend allows requests from this origin)
ALLOWED_ORIGIN=http://localhost:3000

# Optional — Telegram alerts + follow-ups
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

```bash
# 4. Run schema migrations + seed doctors and slots
cd backend && node_modules/.bin/ts-node src/db/migrate.ts
node_modules/.bin/ts-node src/scripts/seed.ts && cd ..

# 5. Start both servers (two terminals)
bun run dev                  # Frontend → http://localhost:3000
cd backend && bun run dev    # Backend  → http://localhost:4000
```

### Production
Copy `.env.production.example` to `.env.production` and fill in production values. Use the Supabase connection pooler URL (port 6543, not 5432) to stay within connection limits. Set `NODE_ENV=production` — the backend automatically loads `.env.production`.

---

## Project Structure

```
CareRoute/
├── src/                               # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                   # Landing + auth modal
│   │   ├── patient/page.tsx           # Triage wizard entry
│   │   ├── dashboard/page.tsx         # Patient dashboard + docs
│   │   ├── appointments/page.tsx      # Booking history
│   │   ├── profile/page.tsx           # Profile + dependent management
│   │   ├── clinician/page.tsx         # Clinician SSE queue
│   │   ├── admin/page.tsx             # Admin stats / users / audit
│   │   ├── timeline/page.tsx          # Symptom progression timeline
│   │   └── api/
│   │       └── triage/route.ts        # Six-Engine triage pipeline entry
│   ├── components/
│   │   ├── TriageWizard.tsx           # Full triage flow (voice, vitals, dependents)
│   │   ├── PrescriptionUploader.tsx   # On-device Donut OCR (WebGL autoregressive)
│   │   ├── DoctorList.tsx             # Specialist cards with booking
│   │   ├── SlotPicker.tsx             # Appointment slot modal
│   │   ├── NearestER.tsx              # ER locator shell + list
│   │   ├── ERMap.tsx                  # Leaflet map (dynamic import, SSR-disabled)
│   │   ├── DocumentManager.tsx        # Upload/list/delete documents
│   │   └── AuthModal.tsx              # Sign up / Sign in
│   └── lib/
│       ├── api.ts                     # Centralised BACKEND_URL
│       ├── durations.ts               # Shared symptom duration constants (UI + parser)
│       ├── emergency.ts               # V1 deterministic emergency pre-check
│       ├── indicNormalizer.ts         # Hinglish→English symptom normaliser (35 mappings)
│       ├── specialty.ts               # Keyword → specialty lookup table
│       ├── storage.ts                 # localStorage triage history (guest fallback)
│       ├── utils.ts                   # Shared helpers (timeAgo)
│       └── pipeline/
│           └── TriagePipeline.ts      # Master controller: Safety→OOD→Rules (engines from @careroute/core)
│
├── packages/
│   └── core/                          # @careroute/core — shared Bun workspace package
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts               # Barrel export
│           ├── types/clinical.ts      # PatientPresentation, DecisionRecord types
│           └── engines/
│               ├── SafetyEngine.ts    # Plausibility + vital collapse + all 5 red flags
│               ├── OodEngine.ts       # Semantic + tabular OOD detection
│               └── ClinicalRuleEngine.ts  # Manchester/ESI text + vitals + demographics
│
├── public/
│   └── models/
│       ├── rx_ocr_quantized.tflite    # Donut Vision Transformer (~1 GB, WebGL, retrained)
│       ├── tokenizer.json             # XLMRoberta SentencePiece vocab
│       ├── special_tokens_map.json    # Special token definitions
│       ├── tokenizer_config.json      # Tokenizer class + token IDs
│       └── drug_dictionary.json       # 251k Indian medicine names (Tata 1mg, gitignored)
│
└── backend/                           # Express API
    └── src/
        ├── index.ts                   # Server entry, route mounting, rate limiting
        ├── routes/
        │   ├── auth.ts                # JWT signup/signin (bcrypt, max 128-char passwords)
        │   ├── triage.ts              # Save, history (paginated), queue (?since=), SSE, review, note
        │   ├── profile.ts             # GET/PATCH patient profile (auto-creates if missing)
        │   ├── dependents.ts          # CRUD dependent profiles (atomic ownership check)
        │   ├── documents.ts           # Upload/list/delete via Supabase Storage
        │   ├── maps.ts                # Overpass API nearest-ER (lat/lng validated)
        │   ├── appointments.ts        # Doctors, slots, book (FOR UPDATE), cancel
        │   ├── admin.ts               # Stats, user management, audit log
        │   └── health.ts              # Health check
        ├── middleware/
        │   └── auth.ts                # requireAuth, requireAdmin, requireClinician
        ├── lib/
        │   ├── supabase.ts            # Supabase admin client + ensureStorageBucket()
        │   ├── telegram.ts            # Emergency alert utility
        │   ├── followup.ts            # 24h follow-up scheduler + daily slot regeneration
        │   └── sse.ts                 # SSE connection pool + heartbeat + stopHeartbeat()
        └── db/
            ├── connection.ts          # pg Pool (max 10, idle 30s, connect 5s)
            ├── schema.sql             # Full idempotent schema (all tables + indexes)
            └── migrate.ts             # Migration runner (runs on every boot)
```

---

## Feature Status

| Phase | Feature | Status |
|---|---|---|
| 0 | Express backend, PostgreSQL schema, JWT auth | ✅ |
| 0 | Rate limiting (tiered: triage save 10/min, maps 20/min, general 100/min) | ✅ |
| 0 | pg.Pool connection limits (max 10, idle timeout, connect timeout) | ✅ |
| 0 | Graceful shutdown (SIGTERM/SIGINT — clears all intervals) | ✅ |
| 0 | Supabase Storage bucket auto-created on startup | ✅ |
| 0 | Production env separation (.env.production + NODE_ENV-aware dotenv) | ✅ |
| 1 | Six-Engine deterministic triage pipeline (no LLM) | ✅ |
| 1 | IndicNormalizer — 35 Hinglish/Hindi → English clinical mappings | ✅ |
| 1 | SafetyEngine — plausibility + vital collapse + all 5 red flags (incl. stroke) | ✅ |
| 1 | OodEngine — semantic + tabular out-of-distribution detection | ✅ |
| 1 | ClinicalRuleEngine — free-text patterns + boolean flags + vitals + demographics | ✅ |
| 1 | Specialty routing — deterministic keyword → specialty lookup | ✅ |
| 1 | CDSCO-compliant DecisionRecord audit log on every inference | ✅ |
| 2 | Patient profile (GET/PATCH) — name, DOB, gender, phone | ✅ |
| 2 | Dependent profiles — add/remove family members, caregiver triage | ✅ |
| 2 | Dependent ownership verified on all triage saves | ✅ |
| 2 | Server-side age/sex fetch — pipeline uses real demographics, not client body | ✅ |
| 3 | Clinician dashboard — queue, review, notes | ✅ |
| 3 | SSE live queue — push on new case, 30s heartbeat, ?since= reconnect gap recovery | ✅ |
| 4 | Document upload → Supabase Storage, signed URLs | ✅ |
| 4 | On-device Donut OCR — WebGL autoregressive decode, zero-dependency tokenizer | ✅ |
| 4 | Tata 1mg fuzzy corrector — 251k Indian drug names, prefix-indexed Levenshtein snap | ✅ |
| 5 | Telegram emergency alerts (non-blocking) | ✅ |
| 5 | 24-hour follow-up engine — batched loop, no LIMIT | ✅ |
| 5 | Daily slot regeneration — 2AM cron keeps doctor availability current | ✅ |
| 6 | Nearest ER map — Leaflet + OpenStreetMap + Overpass API (free) | ✅ |
| 6 | Symptom progression timeline — `/timeline` page | ✅ |
| 6 | Voice-to-text intake — Web Speech API, `en-IN` (Hindi + English) | ✅ |
| 6 | Wearable vitals input — HR, SpO₂, temperature, BP in Step 2 | ✅ |
| 7 | Doctor booking — slots, appointment management, race-safe `FOR UPDATE` | ✅ |
| 7 | Partial unique index on slot bookings (`WHERE status != 'cancelled'`) | ✅ |
| 7 | Admin panel — stats, user management, role control, audit log | ✅ |
| 7 | Paginated triage history (`?limit=&offset=`) | ✅ |
| 7 | CDSCO DecisionRecord compliance viewer — admin audit trail with severity filter | ✅ |

### Deferred (require LLM or additional infrastructure)
- [ ] `condition_guess` — real diagnosis name (currently specialty-derived label)
- [ ] Triage summary — clinical narrative (currently probability percentages)
- [ ] Confidence — real uncertainty score (currently rule-engine derived 90%)

### Not planned
- Google OAuth — email/password is sufficient
- WhatsApp bot — requires paid Twilio/Meta API
- ABDM/ABHA integration — regulatory complexity, out of scope
- SMS fallback — requires paid SMS gateway

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string (use port 6543 pooler in prod) |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase service role key (server-side only, never expose to client) |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens (min 32 chars, cryptographically random) |
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | Backend URL visible to browser (default: `http://localhost:4000`) |
| `ALLOWED_ORIGIN` | ✅ | Frontend origin for CORS (default: `http://localhost:3000`) |
| `TELEGRAM_BOT_TOKEN` | ⚡ Optional | Telegram bot token — disables alerts + follow-ups if absent |
| `TELEGRAM_CHAT_ID` | ⚡ Optional | Telegram chat/group ID for alerts |
| `PORT` | ⚡ Optional | Backend port (default: `4000`) |
| `NODE_ENV` | ⚡ Optional | Set to `production` to load `.env.production` and disable debug output |

---

## License

MIT
