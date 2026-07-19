# CareRoute — Implementation Plan (Rebuild from Scratch)

Personal advanced project. No regulatory constraints assumed (not deployed to real patients).
AI-forward by design. Custom models are a post-launch phase, once the LLM-driven app works end to end.

## Standing principles (apply to every phase)
- Every triage output shows *why* it fired (which rule, which symptom pattern, which model signal). No black-box verdicts.
- A hard-coded emergency branch exists outside the normal flow: certain symptom patterns route straight to "call emergency services / nearest ER" text, independent of whatever else is running.
- Real backend, real DB, TLS, audit log from Phase 0. Not retrofitted later.
- Doctor Portal and alerting run on seeded/demo data, not real physicians or real patients, until you decide otherwise.

---

## Phase 0 — Foundations
**Goal:** empty but real skeleton, nothing fake in it.
- Repo structure, chosen stack locked in (suggest: Next.js frontend, Node/FastAPI backend, Postgres, Redis if you want queues for alerting later).
- DB schema: `users`, `patients`, `doctors`, `triage_cases`, `documents`, `audit_log`.
- Auth (basic email/password is enough, this doesn't need to be fancy for a personal project).
- Base API skeleton, health check endpoint, TLS/local HTTPS from day one.
- **Exit criteria:** you can log in, hit an authenticated API route, and see a row land in Postgres.

## Phase 1 — Core Patient Triage Flow
**Goal:** the actual product concept, working, honestly.
- Symptom intake UI: structured fields (duration, severity self-rating) + free text complaint.
- LLM triage engine v1: single call to Claude/GPT/Gemini, structured output (condition guess, Green/Amber/Red, reasoning, suggested specialty).
- Emergency branch: a deterministic pre-check (keyword/pattern list for chest pain + shortness of breath, stroke signs, severe bleeding, etc.) that runs *before* the LLM call. If it fires, skip straight to the emergency message. Don't let the LLM be the only thing standing between a red-flag input and a response.
- Persistent, unavoidable disclaimer: not a diagnosis, not a replacement for emergency services.
- Save every triage case to `triage_cases`, not localStorage.
- **Exit criteria:** you can type real symptoms, get a color + reasoning + specialty suggestion, and it's stored, not ephemeral.

## Phase 2 — Doctor Directory & Matching
**Goal:** honest, curated routing, not a live marketplace.
- `doctors` table: name, specialty, contact info, you seed this yourself.
- Deterministic specialty-matching lookup (condition/category → specialty), separate from the LLM call. This is a lookup table, not a model, medicine already knows which specialty treats which condition.
- Surface the matching rule in the UI ("matched to Pulmonology because: recurring cough + wheeze pattern").
- **Exit criteria:** a Red or Amber case shows a real doctor from your seeded list with a visible reason.

## Phase 3 — Doctor Portal (Seeded Demo Data)
**Goal:** prove the two-sided architecture without needing real doctors.
- Separate auth-gated section/app.
- Case queue (seeded demo cases + whatever real ones you generate testing your own patient flow).
- Case detail view, urgency surfaced from the triage color, a notes field.
- **Exit criteria:** logging in as a "doctor" shows a queue of real triage_cases rows, sorted by urgency.

## Phase 4 — Document Upload & Extraction (LLM-based v1)
**Goal:** get the feature working before optimizing how it's built.
- File upload (PDF/image), stored against the patient record.
- Extraction v1: LLM vision call (Claude/GPT-4o/Gemini) to pull structured fields (medications, conditions, dates) out of the upload. This gets replaced by a custom pipeline in Phase 8, don't over-invest in it now.
- **Exit criteria:** upload a sample medical document, get structured fields back, attached to the patient's record.

## Phase 5 — Alerting Infrastructure
**Goal:** real pipe, honestly routed.
- Red-flag trigger → webhook/push/SMS, sent to a configurable recipient. Default that recipient to yourself, not a fictional clinician.
- Log every triage decision and every alert fire to `audit_log`, including the reasoning that produced it. Useful for debugging the AI later, not just for show.
- **Exit criteria:** trigger a Red case, get a real notification within seconds, see it in the audit log.

## Phase 6 — ER / Hospital Mapping
**Goal:** cheap, low-risk, genuinely useful.
- Nearest-hospital lookup (Google Maps or a mapping API) surfaced automatically on Red-tier results.
- **Exit criteria:** a Red result shows a map pin and address for the nearest ER to the user's location.

## Phase 7 — Stretch: ID Verification (optional, do if bored)
**Goal:** a CV flex, not a core feature.
- Government-ID-style OCR + face match, purely as a technical demo, gated behind a feature flag, off by default.
- Not connected to any real gatekeeping logic, this is a "look what I can build" feature, not infrastructure.
- **Exit criteria:** upload an ID photo + a selfie, get a match/no-match result. That's it.

---

## Phase 8 — Custom Models (Post-Launch Research & Build)

Three genuinely different subtasks here, three different answers to "where's the data."

### 8a. Symptom → Condition Classifier
**Reality check first:** real, usable datasets exist, your instinct that "something's out there" was right for this one.
- Structured/tabular option: Kaggle "Diseases and Symptoms Dataset" (dhivyeshrk), 773 diseases, 377 one-hot symptom columns, ~246,000 samples. Good for a classical model (XGBoost/Random Forest), fast to train, easy to interpret.
- Free-text option (closer to what your patients actually type): "Symptom2Disease" (Kaggle, niyarrbarman) and the Digital Diagnosis Project's NLP-ready symptom-disease set, both give natural-language complaint text mapped to a disease label, better fit for fine-tuning a small transformer (DistilBERT-class) than the checkbox-style datasets.
- **Key architectural point:** don't build a separate model for disease-to-specialty. That's the Phase 2 lookup table. Spend model capacity on symptom-to-condition only; specialty routing is a solved, deterministic problem once you have the condition.
- **Approach:** start with the tabular XGBoost baseline (cheap, fast, good accuracy on structured symptom data), then optionally fine-tune a small transformer on the free-text version once you want it handling messy patient-typed input instead of checkboxes.

### 8b. Triage Severity Classifier (Green/Amber/Red)
**Reality check first:** this is the one where "no dataset on the planet" is closer to true, at least not one that matches your exact input (free-text self-reported complaint, no vitals, no labs). The real academic datasets for this (MIMIC-IV-ED, NHAMCS) are built from structured ED encounters with vitals and clinician-assigned Emergency Severity Index (ESI) labels, not casual patient-typed text.
- **The honest, better answer isn't "find a dataset," it's distillation:** you already have a working, reasoned triage engine from Phase 1 (your LLM call, with its Green/Amber/Red output and explanation). Use it as a labeling function. Generate a large volume of synthetic and real complaint text, run it through your Phase 1 engine, and use the (complaint, color, reasoning) pairs as training data for a small, fast classifier. This is standard knowledge distillation, it's a legitimately modern technique, not a workaround, and it directly reuses infrastructure you're already building instead of chasing external data.
- **If you want the real deal in addition:** MIMIC-IV-ED is publicly accessible via PhysioNet (requires completing CITI "Data or Specimens Only Research" training and signing a data use agreement, a real but individually achievable process, not institution-gated). There's a published benchmark pipeline (arXiv:2111.11017) that turns raw MIMIC-IV-ED into a standardized ESI-prediction benchmark, so you wouldn't be building the harness from scratch. This gets you a model trained on real clinical acuity judgments, worth doing if you want this specific piece to be portfolio-grade rather than just functional.
- **Practical recommendation:** ship the distilled model first (fast, cheap, no external dependency), treat MIMIC-IV-ED as an optional deeper pass if you want to compare your distilled model against real clinical ESI data later.

### 8c. Medical Entity Extraction (replaces the Phase 4 LLM call)
**Reality check first:** this one needs no dataset and no training at all. Ready-made pretrained models exist and are pip-installable today.
- **Med7:** spaCy-based, extracts 7 medication-related categories (drug, dosage, frequency, route, strength, form, duration), trained on MIMIC-III, published F1 ~0.94. Install directly: `pip install https://huggingface.co/kormilitzin/en_core_med7_lg/resolve/main/en_core_med7_lg-any-py3-none-any.whl`.
- **scispaCy:** Allen AI's biomedical spaCy models (`en_core_sci_sm`/`md`/`lg`, `en_ner_bc5cdr_md`), general biomedical/disease/chemical NER, with UMLS entity linking available.
- **BioMed_NER (Helios9, HuggingFace):** DeBERTaV3-based, broader entity set (diseases, procedures, medications, anatomy), usable directly through the `transformers` pipeline.
- **One real caveat:** these models are trained on formal clinical notes and scientific text. Casual, patient-typed complaint text is a different register, and off-the-shelf accuracy can drop outside their training domain. If extraction quality on your own demo/test inputs looks weak, a small fine-tune on a few hundred examples you write yourself (not a "find a dataset" problem, just eating your own dogfood) will go a long way.
- **Approach:** swap the Phase 4 LLM vision call for one of these directly on extracted document text (OCR first with any standard tool, then NER on the output). This is the cheapest win in this whole phase, do it first.

### 8d. Integration Pattern
Mirrors the hybrid pattern already proven in your other projects (VerdeScan's checkpoint cascade, PragatiPath's offline-model-plus-Gemini split): custom model as the fast, cheap, default path; LLM as the fallback for low-confidence or unusual cases, not a full replacement of the LLM engine.
- Symptom classifier and entity extractor run first, always.
- If confidence is high, skip the LLM call entirely (faster, cheaper).
- If confidence is low, escalate to the Phase 1 LLM engine, the same way your other apps escalate from a local model to Gemini.
- Log which path handled each case (model-only vs. LLM-escalated) to `audit_log`, this becomes real evidence of how often the custom model is actually pulling its weight.

**Exit criteria for Phase 8:** the app runs end to end with the custom symptom classifier and entity extractor as the default path, the LLM as a visible, logged fallback, and (if you did the deep version of 8b) a triage severity model you can honestly compare against MIMIC-IV-ED ESI labels.
