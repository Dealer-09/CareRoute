-- CareRoute — Database Schema
-- Idempotent: safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- Run in: Supabase Dashboard → SQL Editor

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'patient'
                            CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── patients ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  date_of_birth DATE,
  gender        TEXT        CHECK (gender IN ('M', 'F', 'Other')),
  phone         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



-- ─── doctors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  specialty      TEXT        NOT NULL,
  location       TEXT,
  contact        TEXT,
  bio            TEXT,
  experience_yrs INT,
  fee_inr        INT,
  rating         NUMERIC(3,1),
  available      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── triage_cases ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS triage_cases (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  severity              TEXT        NOT NULL CHECK (severity IN ('Green', 'Amber', 'Red')),
  emergency             BOOLEAN     NOT NULL DEFAULT FALSE,
  condition_guess       TEXT,
  summary               TEXT,
  reasoning             JSONB       NOT NULL DEFAULT '[]',
  red_flags             JSONB       NOT NULL DEFAULT '[]',
  recommended_specialty TEXT,
  specialty_reason      TEXT,
  advice                TEXT,
  duration              TEXT,
  symptom_text          TEXT,
  for_dependent_id      UUID        REFERENCES dependents(id) ON DELETE SET NULL,
  for_name              TEXT,
  reviewed              BOOLEAN     NOT NULL DEFAULT FALSE,
  reviewed_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  clinician_note        TEXT,
  confidence            INT,
  decision_record       JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  triage_case_id  UUID        REFERENCES triage_cases(id) ON DELETE SET NULL,
  file_name       TEXT        NOT NULL,
  storage_path    TEXT,
  mime_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── audit_log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── doctor_slots ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_slots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  is_booked   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, starts_at)
);

-- ─── appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id       UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  slot_id         UUID        NOT NULL REFERENCES doctor_slots(id) ON DELETE CASCADE,
  triage_case_id  UUID        REFERENCES triage_cases(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'confirmed'
                              CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Only one active (non-cancelled) appointment per slot at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_slot_active
  ON appointments (slot_id)
  WHERE status != 'cancelled';

-- ─── dependents ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dependents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  date_of_birth DATE,
  gender        TEXT        CHECK (gender IN ('M', 'F', 'Other')),
  relationship  TEXT        NOT NULL DEFAULT 'Child'
                            CHECK (relationship IN ('Child', 'Parent', 'Spouse', 'Sibling', 'Other')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── follow_ups ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  triage_case_id  UUID        NOT NULL REFERENCES triage_cases(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  due_at          TIMESTAMPTZ NOT NULL,
  sent            BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (triage_case_id)
);

-- ─── drug_registry ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drug_registry (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  active_ingredient   TEXT        NOT NULL UNIQUE,
  is_banned_fdc       BOOLEAN     NOT NULL DEFAULT FALSE,
  regulatory_source   TEXT,
  last_verified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── cdsco_ingestion_logs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cdsco_ingestion_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  records_processed   INT         NOT NULL,
  new_bans_detected   INT         NOT NULL,
  status              TEXT        NOT NULL CHECK (status IN ('PENDING_HUMAN_APPROVAL', 'AUTO_APPROVED', 'FAILED')),
  payload_hash        TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS reviewed          BOOLEAN     NOT NULL DEFAULT FALSE;
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS reviewed_by       UUID        REFERENCES users(id) ON DELETE SET NULL;
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS clinician_note    TEXT;
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS for_dependent_id  UUID        REFERENCES dependents(id) ON DELETE SET NULL;
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS for_name          TEXT;
  ALTER TABLE triage_cases ADD COLUMN IF NOT EXISTS confidence        INT;
  BEGIN
    ALTER TABLE follow_ups ADD CONSTRAINT follow_ups_triage_case_id_key UNIQUE (triage_case_id);
  EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
  END;
  -- Drop the overly strict UNIQUE constraint on slot_id if it exists (replaced by partial index)
  ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_slot_id_key;
  ALTER TABLE doctors      ADD COLUMN IF NOT EXISTS bio               TEXT;
  ALTER TABLE doctors      ADD COLUMN IF NOT EXISTS experience_yrs    INT;
  ALTER TABLE doctors      ADD COLUMN IF NOT EXISTS fee_inr           INT;
  ALTER TABLE doctors      ADD COLUMN IF NOT EXISTS rating            NUMERIC(3,1);
END $$;

-- ─── Indexes — after migrations so all columns exist ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_user_id            ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_user_id             ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_triage_cases_reviewed_by    ON triage_cases(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_triage_cases_for_dependent_id ON triage_cases(for_dependent_id);
CREATE INDEX IF NOT EXISTS idx_documents_patient_id        ON documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_triage_case_id    ON documents(triage_case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_triage_case_id ON appointments(triage_case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_slot_id        ON appointments(slot_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_patient_id       ON follow_ups(patient_id);
CREATE INDEX IF NOT EXISTS idx_triage_cases_severity       ON triage_cases(severity);
CREATE INDEX IF NOT EXISTS idx_triage_cases_created_at     ON triage_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_cases_reviewed       ON triage_cases(reviewed);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id           ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action            ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_doctor_slots_doctor_id      ON doctor_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_slots_starts_at      ON doctor_slots(starts_at);
CREATE INDEX IF NOT EXISTS idx_doctor_slots_is_booked      ON doctor_slots(is_booked);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id     ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id      ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status         ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_dependents_user_id          ON dependents(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_at           ON follow_ups(due_at) WHERE sent = FALSE;
