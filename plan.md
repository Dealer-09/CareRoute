# CareRoute — Remaining Implementation Plan

> Phases 0–7 are complete. This file tracks what's still left to build.
> See README.md for full architecture and what's already shipped.

---

## Standing Principles (apply to every remaining phase)
- Every triage output shows *why* it fired (which rule, which symptom pattern, which model signal). No black-box verdicts.
- A hard-coded emergency branch exists outside the normal flow — certain symptom patterns route straight to "call emergency services / nearest ER", independent of whatever else is running.
- Doctor Portal and alerting run on seeded/demo data, not real physicians or real patients, until decided otherwise.

---

## Phase 4b — Document Intelligence (Partially Done)

**What's done:** File upload, storage in Supabase, signed URLs, patient record attachment.

**What's NOT done:** LLM extraction of structured fields from uploaded documents.

- LLM vision call (Gemini) to pull structured fields (medications, conditions, dates) out of uploaded PDFs/images
- Surface extracted fields in the patient dashboard alongside the document
- This gets replaced by a custom pipeline in Phase 8c — don't over-invest now, one Gemini call is enough

**Exit criteria:** Upload a sample medical document (discharge summary, prescription), get structured fields back (medication names, dosages, conditions, dates), displayed alongside the file in the dashboard.

---

## Phase 7b — ID Verification (Optional / Flex Feature)

**Goal:** A CV flex, not a core feature.

- Government-ID-style OCR + face match, purely as a technical demo
- Gated behind a feature flag, off by default
- Not connected to any real gatekeeping logic

**Exit criteria:** Upload an ID photo + a selfie, get a match/no-match result. That's it.

---

## Phase 8 — Custom Models (Post-Launch Research & Build)

Three genuinely different subtasks, three different answers to "where's the data."

### 8a. Symptom → Condition Classifier

**Reality check first:** real, usable datasets exist.

- **Structured/tabular option:** Kaggle "Diseases and Symptoms Dataset" (dhivyeshrk) — 773 diseases, 377 one-hot symptom columns, ~246,000 samples. Good for XGBoost/Random Forest, fast to train, easy to interpret.
- **Free-text option** (closer to what patients actually type): "Symptom2Disease" (Kaggle, niyarrbarman) and the Digital Diagnosis Project's NLP-ready set — natural-language complaint text mapped to a disease label, better fit for fine-tuning a small transformer (DistilBERT-class).
- **Key architectural point:** don't build a separate model for disease-to-specialty. That's the existing lookup table. Spend model capacity on symptom-to-condition only.
- **Approach:** start with the tabular XGBoost baseline (cheap, fast, good accuracy on structured symptom data), then optionally fine-tune a small transformer on the free-text version.

### 8b. Triage Severity Classifier (Green/Amber/Red)

**Reality check:** no dataset directly matches free-text self-reported complaints with no vitals or labs. Real academic datasets (MIMIC-IV-ED, NHAMCS) are built from structured ED encounters.

- **The honest, better answer is distillation:** use the existing Phase 1 LLM triage engine as a labeling function. Generate a large volume of synthetic and real complaint text, run through the LLM engine, use (complaint, color, reasoning) pairs as training data for a small fast classifier. Standard knowledge distillation — a legitimately modern technique, not a workaround.
- **If you want the real deal in addition:** MIMIC-IV-ED is publicly accessible via PhysioNet (requires CITI training + data use agreement). There's a published benchmark pipeline (arXiv:2111.11017) that turns raw MIMIC-IV-ED into a standardized ESI-prediction benchmark.
- **Practical recommendation:** ship the distilled model first (fast, cheap, no external dependency), treat MIMIC-IV-ED as an optional deeper pass to compare against real clinical ESI data.

### 8c. Medical Entity Extraction (replaces Phase 4b LLM call)

**Reality check:** this one needs no dataset and no training at all. Ready-made pretrained models exist and are pip-installable today.

- **Med7:** spaCy-based, extracts 7 medication-related categories (drug, dosage, frequency, route, strength, form, duration). Trained on MIMIC-III, published F1 ~0.94.
  ```
  pip install https://huggingface.co/kormilitzin/en_core_med7_lg/resolve/main/en_core_med7_lg-any-py3-none-any.whl
  ```
- **scispaCy:** Allen AI's biomedical spaCy models (`en_core_sci_sm/md/lg`, `en_ner_bc5cdr_md`) — general biomedical/disease/chemical NER, with UMLS entity linking.
- **BioMed_NER (Helios9, HuggingFace):** DeBERTaV3-based, broader entity set (diseases, procedures, medications, anatomy), usable directly via `transformers` pipeline.
- **One real caveat:** these models are trained on formal clinical notes. Casual patient-typed complaint text is a different register — accuracy can drop. A small fine-tune on a few hundred self-written examples will go a long way if extraction quality looks weak.
- **Approach:** swap the Phase 4b Gemini vision call for one of these. OCR first with any standard tool, then NER on the extracted text. This is the cheapest win in this whole phase — do it first.

### 8d. Integration Pattern (Hybrid Model + LLM)

Mirrors the hybrid pattern: custom model as the fast, cheap, default path; LLM as the fallback for low-confidence or unusual cases.

- Symptom classifier and entity extractor run first, always
- If confidence is high → skip the LLM call entirely (faster, cheaper)
- If confidence is low → escalate to the Phase 1 LLM engine
- Log which path handled each case (model-only vs LLM-escalated) to `audit_log` — real evidence of how often the custom model pulls its weight

**Exit criteria for Phase 8:** app runs end to end with the custom symptom classifier and entity extractor as the default path, the LLM as a visible, logged fallback, and (if you did the deep version of 8b) a triage severity model comparable against MIMIC-IV-ED ESI labels.

---

## Near-Term Polish (No Research Required)

These are quick wins from the competitive research that require no new infrastructure:

| Feature | What | Effort |
|---|---|---|
| Confidence interval | Add confidence % to triage result + clinician view | 1 day |
| Explainability engine | Show which specific flags triggered Red/Amber/Green | 2 days |
| Green reassurance copy | Self-care advice + escalation conditions for Green results | 1 day |
| Indic idiom mapping | Add cultural idiom context to Gemini system prompt | 1 day |
| Symptom timeline | Visual progression of past triage cases | 2 days |
| PubMed citations | Link triage result to 1–2 matching PubMed papers (free API) | 2 days |
| WebSockets queue | Live clinician queue without page refresh | 2 days |
| Admin panel | User management, audit log viewer, stats | 4 days |
| Voice intake | Web Speech API for Hindi/English symptom input | 2 days |
| SMS alerts | Fallback alongside Telegram | 1 day |
| Clinician auth guard | Protect /clinician route from unauthorized access | 1 day |
