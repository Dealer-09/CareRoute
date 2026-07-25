# CareRoute 🏥

> AI-powered medical triage, specialist routing, and appointment booking — built for the Indian healthcare market.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Express](https://img.shields.io/badge/Express-TypeScript-green?logo=express)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-blue?logo=google)](https://deepmind.google/gemini)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?logo=bun)](https://bun.sh)

---

## What is CareRoute?

CareRoute triages a patient's symptoms using Gemini 2.5 Flash, routes them to the right specialist, lets them book a real appointment slot, and if it's an emergency — fires a Telegram alert to the clinical team and shows the nearest ER on a live map.

---

## Architecture

```mermaid
graph TB
    subgraph Client["Frontend — Next.js 16 (port 3000)"]
        A[Landing Page / Auth]
        B[Patient: Triage Wizard]
        C[Patient: Dashboard]
        D[Patient: Appointments]
        E[Patient: Profile]
        F[Clinician: Queue Dashboard]
    end

    subgraph Backend["Backend — Express + TypeScript (port 4000)"]
        G[Auth Routes]
        H[Triage Routes]
        I[Profile Routes]
        J[Documents Routes]
        K[Maps Routes]
        L[Appointments Routes]
    end

    subgraph Services["External Services"]
        M[(Supabase PostgreSQL)]
        N[Supabase Storage]
        O[Gemini 2.5 Flash API]
        P[Overpass API — OpenStreetMap]
        Q[Telegram Bot API]
    end

    A -->|JWT| G
    B -->|POST /api/triage/save| H
    H -->|Symptom text| O
    O -->|JSON triage result| H
    H -->|Red/Emergency| Q
    B -->|GET /api/maps/nearest-er| K
    K -->|Overpass QL query| P
    C -->|GET /api/documents| J
    J -->|Upload/Download| N
    D -->|GET /api/doctors| L
    D -->|POST /api/appointments| L
    F -->|GET /api/triage/queue| H
    G & H & I & J & K & L -->|SQL| M
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

    P->>FE: Describes symptoms (Step 1–2)
    FE->>BE: POST /api/triage/save {symptom_text, duration, flags}
    BE->>BE: Emergency pre-check (deterministic)
    alt Emergency detected pre-LLM
        BE-->>FE: {severity: Red, emergency: true}
        BE->>TG: sendEmergencyAlert() [non-blocking]
    else Not emergency
        BE->>GEM: Prompt with strict JSON schema
        GEM-->>BE: {severity, condition_guess, specialty, advice, red_flags}
        alt Red or Emergency from LLM
            BE->>TG: sendEmergencyAlert() [non-blocking]
        end
        BE-->>FE: Full triage result
    end
    FE->>P: Show result + specialist cards + ER map (if Red)
```

---

## User Flows

### Patient
```
/ (Landing)
  └── Sign Up / Sign In
        └── /patient — Triage Wizard
              ├── Step 1: Describe symptoms (free text)
              ├── Step 2: Flag critical symptoms + duration
              └── Step 3: AI Result
                    ├── GREEN  → Reassurance + self-care advice + specialist
                    ├── AMBER  → Specialist recommendation + Book appointment
                    └── RED    → 🚨 Emergency banner + Nearest ER map + Specialist

/dashboard
  ├── Assessment history (timeline)
  └── Document uploads (PDF/JPEG/PNG → Supabase Storage)

/appointments
  ├── Upcoming appointments (with cancel)
  └── Past appointments

/profile
  └── Name, DOB, gender → saved to DB
```

### Clinician
```
Sign in (role: doctor)
  └── /clinician
        ├── Live patient queue (unreviewed → Red first)
        ├── Review button → marks case reviewed
        └── Note button → saves clinical note inline
```

### Emergency Path (automatic, no user action needed)
```
Red or Emergency triage result
  → Telegram alert fires to clinical team (non-blocking background task)
  → Patient sees Leaflet map with nearest hospitals (Overpass API)
  → Each hospital has: name, distance, ER badge, phone, Google Maps directions
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), Vanilla CSS |
| **Backend** | Express 4, TypeScript, Bun runtime |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | JWT (bcrypt, 7-day tokens) |
| **AI** | Gemini 2.5 Flash — strict JSON schema output |
| **Storage** | Supabase Storage (documents) |
| **Maps** | Leaflet + react-leaflet, OpenStreetMap tiles, Overpass API |
| **Alerts** | Telegram Bot API (native fetch, non-blocking) |
| **Runtime** | Bun (entire project) |

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
        TEXT severity
        BOOL emergency
        TEXT condition_guess
        TEXT recommended_specialty
        TEXT advice
        JSONB reasoning
        JSONB red_flags
        BOOL reviewed
        TEXT clinician_note
    }
    documents {
        UUID id PK
        UUID patient_id FK
        UUID triage_case_id FK
        TEXT file_name
        TEXT storage_path
        TEXT mime_type
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
    }
    audit_log {
        UUID id PK
        UUID user_id FK
        TEXT action
        TEXT entity_type
        UUID entity_id
        JSONB payload
    }

    users ||--o{ patients : "has"
    users ||--o{ doctors : "may link"
    patients ||--o{ triage_cases : "submits"
    patients ||--o{ documents : "uploads"
    patients ||--o{ appointments : "books"
    doctors ||--o{ doctor_slots : "has"
    doctor_slots ||--o| appointments : "booked via"
    triage_cases ||--o{ documents : "attached to"
    triage_cases ||--o{ appointments : "triggers"
```

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register patient or doctor |
| POST | `/api/auth/signin` | — | Login, returns JWT |

### Patient
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/profile` | ✅ | Get patient profile |
| PATCH | `/api/profile` | ✅ | Update name, DOB, gender |
| POST | `/api/triage/save` | ✅ | Run AI triage + save result |
| GET | `/api/triage/history` | ✅ | Patient's past triage cases |
| POST | `/api/documents/upload` | ✅ | Upload document to Supabase Storage |
| GET | `/api/documents` | ✅ | List patient's documents |
| DELETE | `/api/documents/:id` | ✅ | Delete document |
| GET | `/api/doctors?specialty=` | — | List doctors (filtered by specialty) |
| GET | `/api/doctors/:id/slots` | — | Available 30-min slots (next 7 days) |
| POST | `/api/appointments` | ✅ | Book a slot (race-safe with FOR UPDATE) |
| GET | `/api/appointments` | ✅ | Patient's appointments |
| PATCH | `/api/appointments/:id/cancel` | ✅ | Cancel + release slot |

### Clinician
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/triage/queue` | ✅ (doctor) | All patient triage cases |
| PATCH | `/api/triage/:id/review` | ✅ (doctor) | Mark case reviewed |
| PATCH | `/api/triage/:id/note` | ✅ (doctor) | Save clinical note |

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
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
JWT_SECRET=any-long-random-string
TELEGRAM_BOT_TOKEN=your-bot-token   # optional
TELEGRAM_CHAT_ID=your-chat-id       # optional
```

```bash
# 4. Run schema + seed doctors and slots
cd backend && bun run src/scripts/seed.ts && cd ..

# 5. Start both servers
bun run dev          # Frontend → http://localhost:3000
cd backend && bun run dev  # Backend  → http://localhost:4000
```

---

## Project Structure

```
CareRoute/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── page.tsx              # Landing + auth
│   │   ├── patient/page.tsx      # Triage wizard entry
│   │   ├── dashboard/page.tsx    # Patient dashboard + docs
│   │   ├── appointments/page.tsx # Booking history
│   │   ├── profile/page.tsx      # Patient profile
│   │   ├── clinician/page.tsx    # Clinician queue
│   │   └── api/triage/route.ts   # Next.js AI triage API route
│   ├── components/
│   │   ├── TriageWizard.tsx      # 3-step triage flow
│   │   ├── DoctorList.tsx        # Live DB doctor cards
│   │   ├── SlotPicker.tsx        # Appointment booking modal
│   │   ├── NearestER.tsx         # ER locator shell
│   │   ├── ERMap.tsx             # Leaflet map (SSR-disabled)
│   │   ├── DocumentManager.tsx   # Upload/delete documents
│   │   └── AuthModal.tsx         # Sign up / Sign in
│   └── lib/
│       └── storage.ts            # localStorage triage history
│
└── backend/                      # Express API
    └── src/
        ├── index.ts              # Server entry, route mounting
        ├── routes/
        │   ├── auth.ts           # JWT auth
        │   ├── triage.ts         # Save, history, queue, review, note
        │   ├── profile.ts        # GET/PATCH patient profile
        │   ├── documents.ts      # Upload/list/delete via Supabase Storage
        │   ├── maps.ts           # Overpass API nearest-ER
        │   └── appointments.ts   # Doctors, slots, book, cancel
        ├── middleware/
        │   └── auth.ts           # JWT verification middleware
        ├── lib/
        │   ├── supabase.ts       # Supabase admin client
        │   └── telegram.ts       # Emergency alert utility
        └── db/
            ├── connection.ts     # pg Pool
            ├── schema.sql        # Full idempotent schema
            └── migrate.ts        # Migration runner
```

---

## What's Built (Phases 0–7)

| Phase | Feature | Status |
|---|---|---|
| 0 | Express backend, PostgreSQL schema, JWT auth | ✅ |
| 1 | Gemini 2.5 Flash triage, emergency pre-check, specialist routing | ✅ |
| 2 | Patient profile (GET/PATCH) | ✅ |
| 3 | Clinician dashboard — queue, review, notes | ✅ |
| 4 | Document upload → Supabase Storage, signed URLs | ✅ |
| 5 | Telegram emergency alerts (non-blocking) | ✅ |
| 6 | Nearest ER map — Leaflet + OpenStreetMap + Overpass API (free) | ✅ |
| 7 | Doctor booking — slots, appointment management, race-safe booking | ✅ |

## What's Coming (Phase 8+)

- [ ] Confidence interval on triage result
- [ ] Clinical explainability engine (why Gemini chose Red/Amber/Green)
- [ ] WebSockets — live clinician queue
- [ ] Admin panel
- [ ] Voice-to-text intake (Hindi + English)
- [ ] WhatsApp bot interface
- [ ] SMS alert fallback
- [ ] ABDM/ABHA integration (India regulatory)
- [ ] AI SOAP note generation for clinicians
- [ ] Async follow-up engine (24h check-ins)
- [ ] E-pharmacy routing (1mg/Pharmeasy)
- [ ] B2B hospital webhooks

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role (server-side only) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `TELEGRAM_BOT_TOKEN` | ⚡ Optional | Telegram bot token for emergency alerts |
| `TELEGRAM_CHAT_ID` | ⚡ Optional | Telegram chat/group ID for alerts |

---

## License

MIT
