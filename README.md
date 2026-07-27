# CareRoute 🏥

> AI-powered medical triage, specialist routing, and appointment booking — built for the Indian healthcare market.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Express-TypeScript-green?logo=express)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-blue?logo=google)](https://deepmind.google/gemini)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?logo=bun)](https://bun.sh)

---

## What is CareRoute?

CareRoute triages a patient's symptoms using Gemini 2.5 Flash, routes them to the right specialist, lets them book a real appointment slot, fires a Telegram alert on emergencies, shows the nearest ER on a live map, sends 24-hour follow-up reminders, and gives clinicians a live SSE-powered dashboard to manage their queue.

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

    subgraph Backend["Backend — Express + TypeScript (port 4000)"]
        I[Auth Routes]
        J[Triage Routes + SSE]
        K[Profile Routes]
        L[Documents Routes]
        M[Maps Routes]
        N[Appointments Routes]
        O[Admin Routes]
        P[Dependents Routes]
        Q[Follow-up Scheduler]
    end

    subgraph Services["External Services"]
        R[(Supabase PostgreSQL)]
        S[Supabase Storage]
        T[Gemini 2.5 Flash API]
        U[Overpass API — OpenStreetMap]
        V[Telegram Bot API]
        W[PubMed E-utilities API]
    end

    A -->|JWT| I
    B -->|POST /api/triage/save| J
    J -->|Symptom text| T
    T -->|JSON triage result| J
    J -->|Red/Emergency| V
    J -->|SSE broadcast| F
    B -->|GET /api/maps/nearest-er| M
    M -->|Overpass QL query| U
    B -->|PubMed citations| W
    C -->|GET /api/documents| L
    L -->|Upload/Download| S
    D -->|GET /api/doctors| N
    D -->|POST /api/appointments| N
    G -->|GET /api/admin/stats| O
    Q -->|24h Telegram reminder| V
    I & J & K & L & M & N & O & P -->|SQL| R
```

---

## Data Flow — Triage

```mermaid
sequenceDiagram
    participant P as Patient
    participant FE as Frontend
    participant BE as Backend
    participant GEM as Gemini 2.5 Flash
    participant TG as Telegram
    participant PM as PubMed

    P->>FE: Describes symptoms (voice or text, Hindi/English)
    FE->>BE: POST /api/triage/save {symptom_text, vitals, for_dependent_id?}
    BE->>BE: Emergency pre-check (deterministic)
    alt Emergency detected pre-LLM
        BE-->>FE: {severity: Red, emergency: true}
        BE->>TG: sendEmergencyAlert() [non-blocking]
    else Not emergency
        BE->>GEM: Prompt with Indic idiom context + demographic section
        GEM-->>BE: {severity, condition_guess, specialty, advice, reasoning, red_flags, confidence}
        alt Red or Amber from LLM
            BE->>TG: sendEmergencyAlert() [non-blocking]
            BE->>BE: scheduleFollowUp() → follow_ups table
        end
        BE-->>FE: Full triage result
    end
    FE->>PM: Fetch 3 PubMed citations for condition [client-side]
    FE->>P: Result + reasoning + citations + specialist cards + ER map (if Red)
```

---

## User Flows

### Patient
```
/ (Landing)
  └── Sign Up / Sign In
        └── /patient — Triage Wizard
              ├── Step 1: Describe symptoms (free text or 🎤 voice, Hindi + English)
              │          + "For whom?" selector (myself / dependent)
              ├── Step 2: Vitals (HR, SpO₂, temp, BP) + symptom flags + duration
              └── Step 3: AI Result
                    ├── GREEN  → Reassurance + self-care advice + PubMed citations
                    ├── AMBER  → Specialist recommendation + Book appointment + citations
                    └── RED    → 🚨 Emergency banner + Nearest ER map + Book appointment

/dashboard
  ├── Assessment history (filterable, from DB)
  └── Document uploads (PDF/JPEG/PNG → Supabase Storage + Gemini extraction)

/timeline
  └── Symptom progression chart across all past cases

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
        ├── Live patient queue via SSE (no polling — push updates on new case)
        ├── Red cases bubble to top, sorted by severity then time
        ├── Review button → marks case reviewed
        └── Note button → saves clinical note inline
```

### Admin
```
Sign in (role: admin)
  └── /admin
        ├── Stats — total cases, red/amber/green breakdown, active users
        ├── User management — list, change role, delete
        └── Audit log — all profile changes, role updates, deletions
```

### Emergency Path (automatic)
```
Red or Emergency triage result
  → Telegram alert fires to clinical team (non-blocking, concurrent with response)
  → 24-hour follow-up scheduled in follow_ups table
  → Hourly scheduler sends Telegram check-in reminder at T+24h
  → Patient sees Leaflet map with nearest hospitals (Overpass API)
  → Each hospital has: name, distance, ER badge, phone, Google Maps directions
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), Vanilla CSS, Turbopack |
| **Backend** | Express 4, TypeScript, Bun runtime |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | JWT (bcrypt, 7-day tokens) |
| **AI — Triage** | Gemini 2.5 Flash — strict JSON schema output |
| **AI — Documents** | Gemini 2.0 Flash — structured field extraction from PDFs/images |
| **Storage** | Supabase Storage (documents) |
| **Maps** | Leaflet + react-leaflet, OpenStreetMap tiles, Overpass API |
| **Alerts** | Telegram Bot API (native fetch, non-blocking) |
| **Real-time** | Server-Sent Events (SSE) — clinician queue push |
| **Citations** | PubMed E-utilities API (free, no key required) |
| **Voice** | Web Speech API — `en-IN` locale (Hindi + English) |
| **Runtime** | Bun (entire project — frontend + backend) |

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
        UUID patient_id FK
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
        TEXT recommended_specialty
        TEXT advice
        JSONB reasoning
        JSONB red_flags
        INT confidence
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
    patients ||--o{ dependents : "manages"
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
| PATCH | `/api/profile` | ✅ | Update profile fields |
| GET | `/api/dependents` | ✅ | List dependents |
| POST | `/api/dependents` | ✅ | Add dependent |
| DELETE | `/api/dependents/:id` | ✅ | Remove dependent |
| POST | `/api/triage/save` | ✅ | Run AI triage + save result |
| GET | `/api/triage/history` | ✅ | Patient's past triage cases |
| POST | `/api/documents/upload` | ✅ | Upload document to Supabase Storage |
| GET | `/api/documents` | ✅ | List patient's documents |
| DELETE | `/api/documents/:id` | ✅ | Delete document |
| GET | `/api/doctors?specialty=` | — | List doctors (filtered by specialty) |
| GET | `/api/doctors/:id/slots` | — | Available 30-min slots (next 7 days) |
| POST | `/api/appointments` | ✅ | Book a slot (race-safe `SELECT FOR UPDATE`) |
| GET | `/api/appointments` | ✅ | Patient's appointments |
| PATCH | `/api/appointments/:id/cancel` | ✅ | Cancel + release slot |

### Clinician
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/triage/queue` | ✅ doctor | All patient triage cases |
| GET | `/api/triage/queue/stream` | ✅ doctor | SSE stream — push on new case |
| PATCH | `/api/triage/:id/review` | ✅ doctor | Mark case reviewed |
| PATCH | `/api/triage/:id/note` | ✅ doctor | Save clinical note |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | ✅ admin | Case counts by severity, active users |
| GET | `/api/admin/triage/recent` | ✅ admin | Recent triage cases |
| GET | `/api/admin/users` | ✅ admin | User list with search |
| PATCH | `/api/admin/users/:id/role` | ✅ admin | Change user role |
| DELETE | `/api/admin/users/:id` | ✅ admin | Delete user |
| GET | `/api/admin/audit` | ✅ admin | Audit log with action filter |

### Next.js API Routes (frontend)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/triage` | Gemini triage proxy (called by TriageWizard) |

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
- Gemini API key ([Google AI Studio](https://aistudio.google.com))
- Telegram Bot token (optional, for alerts)

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

# AI
GEMINI_API_KEY=your-gemini-key

# Auth
JWT_SECRET=any-long-random-string

# Backend URL (for frontend → backend calls)
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Optional — Telegram alerts + follow-ups
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

```bash
# 4. Run schema migrations + seed doctors and slots
cd backend && bun run src/db/migrate.ts && cd ..

# 5. Start both servers (two terminals)
bun run dev                  # Frontend → http://localhost:3000
cd backend && bun run dev    # Backend  → http://localhost:4000
```

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
│   │       └── triage/route.ts        # Gemini triage proxy
│   ├── components/
│   │   ├── TriageWizard.tsx           # Full triage flow (voice, vitals, dependents)
│   │   ├── DoctorList.tsx             # Specialist cards with booking
│   │   ├── SlotPicker.tsx             # Appointment slot modal
│   │   ├── NearestER.tsx             # ER locator shell + list
│   │   ├── ERMap.tsx                  # Leaflet map (dynamic import, SSR-disabled)
│   │   ├── DocumentManager.tsx        # Upload/extract/delete documents
│   │   └── AuthModal.tsx              # Sign up / Sign in
│   └── lib/
│       ├── api.ts                     # Centralised BACKEND_URL
│       ├── storage.ts                 # localStorage triage history (offline fallback)
│       └── utils.ts                   # Shared helpers (timeAgo)
│
└── backend/                           # Express API
    └── src/
        ├── index.ts                   # Server entry, route mounting
        ├── routes/
        │   ├── auth.ts                # JWT signup/signin
        │   ├── triage.ts              # Save, history, queue, SSE stream, review, note
        │   ├── profile.ts             # GET/PATCH patient profile
        │   ├── dependents.ts          # CRUD dependent profiles
        │   ├── documents.ts           # Upload/list/delete via Supabase Storage
        │   ├── maps.ts                # Overpass API nearest-ER
        │   ├── appointments.ts        # Doctors, slots, book (FOR UPDATE), cancel
        │   └── admin.ts               # Stats, user management, audit log
        ├── middleware/
        │   └── auth.ts                # JWT verification + role guard
        ├── lib/
        │   ├── supabase.ts            # Supabase admin client
        │   ├── telegram.ts            # Emergency alert utility
        │   ├── followup.ts            # 24h follow-up scheduler (hourly setInterval)
        │   └── sse.ts                 # SSE connection pool + heartbeat
        └── db/
            ├── connection.ts          # pg Pool
            ├── schema.sql             # Full idempotent schema (all tables)
            └── migrate.ts             # Migration runner
```

---

## Feature Status

| Phase | Feature | Status |
|---|---|---|
| 0 | Express backend, PostgreSQL schema, JWT auth | ✅ |
| 1 | Gemini 2.5 Flash triage, emergency pre-check, specialist routing | ✅ |
| 1 | Indic idiom mapping — Indian English symptom expressions in system prompt | ✅ |
| 1 | Confidence interval on every triage result | ✅ |
| 1 | Clinical explainability — `reasoning[]` array displayed on result card | ✅ |
| 2 | Patient profile (GET/PATCH) — name, DOB, gender, phone | ✅ |
| 2 | Dependent profiles — add/remove family members, caregiver triage | ✅ |
| 3 | Clinician dashboard — queue, review, notes | ✅ |
| 3 | SSE live clinician queue — push on new case, 30s heartbeat | ✅ |
| 4 | Document upload → Supabase Storage, signed URLs | ✅ |
| 4 | Document intelligence — Gemini 2.0 Flash field extraction from PDF/image | ✅ |
| 5 | Telegram emergency alerts (non-blocking) | ✅ |
| 5 | 24-hour follow-up engine — Telegram check-in after Red/Amber cases | ✅ |
| 6 | Nearest ER map — Leaflet + OpenStreetMap + Overpass API (free) | ✅ |
| 6 | Symptom progression timeline — `/timeline` page | ✅ |
| 6 | PubMed citation links — 3 citations fetched client-side after each result | ✅ |
| 6 | Voice-to-text intake — Web Speech API, `en-IN` (Hindi + English) | ✅ |
| 6 | Wearable vitals input — HR, SpO₂, temperature, BP in Step 2 | ✅ |
| 7 | Doctor booking — slots, appointment management, race-safe `FOR UPDATE` | ✅ |
| 7 | Admin panel — stats, user management, role control, audit log | ✅ |

### Not planned
- Google OAuth — simple email/password is sufficient
- WhatsApp bot — requires paid Twilio/Meta API
- ABDM/ABHA integration — regulatory complexity, out of scope
- SMS fallback — requires paid SMS gateway

### Post-launch (Phase 8 ML)
- [ ] Custom symptom → condition classifier (XGBoost / DistilBERT)
- [ ] Triage severity distillation (train small model on LLM-labeled data)
- [ ] Medical entity extraction (Med7 / scispaCy replacing Gemini for docs)
- [ ] Hybrid model + LLM routing with audit logging

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase service role key (server-side only) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | Backend URL (default: `http://localhost:4000`) |
| `TELEGRAM_BOT_TOKEN` | ⚡ Optional | Telegram bot token — disables alerts + follow-ups if absent |
| `TELEGRAM_CHAT_ID` | ⚡ Optional | Telegram chat/group ID for alerts |

---

## License

MIT
