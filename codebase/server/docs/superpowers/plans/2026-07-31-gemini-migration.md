# Gemini API Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the backend from the legacy AI API to the official Google Gemini API without changing its public API contract.

**Architecture:** A dedicated Gemini adapter owns configuration, SDK invocation, multimodal conversion, structured-output configuration, and sanitized errors. Summary and tutor retain their existing business flows and call the adapter.

**Tech Stack:** FastAPI, Pydantic, `google-genai`, unittest/pytest.

## Global Constraints

- Require exactly `GEMINI_API_KEY` and `GEMINI_MODEL`; never log or hardcode API keys.
- Preserve endpoints, schemas, evidence validation, caching, and fallback behavior.
- Remove legacy provider configuration and custom HTTP transport references.
- Keep edits scoped to the server and do not modify frontend files.

---

### Task 1: Gemini configuration and adapter

**Files:**
- Create: `app/services/gemini_service.py`
- Modify: `app/main.py`, `requirements.txt`
- Test: `tests/test_pdf_pipeline.py`

**Interfaces:**
- Produces `GeminiConfigurationError`, `validate_gemini_configuration()`, and async `generate_content(system_instruction, content, temperature, response_mime_type=None)`.

- [ ] Add failing tests for missing variables and adapter result handling.
- [ ] Implement configuration validation, inline PNG conversion, official SDK call, and sanitized exceptions.
- [ ] Validate variables in application lifespan before extraction.
- [ ] Add `google-genai` dependency.

### Task 2: Summary and tutor migration

**Files:**
- Modify: `app/services/summary_service.py`, `app/services/tutor_service.py`, `app/schemas/summary.py`, `app/schemas/tutor.py`
- Test: `tests/test_pdf_pipeline.py`

**Interfaces:**
- Consumes `generate_content()` from the Gemini adapter.
- Produces existing `generate_summary()` and `chat_with_tutor()` responses with `provider="gemini"` for remote success.

- [ ] Replace legacy request construction and `choices` parsing with adapter calls.
- [ ] Retain retry, evidence, cache, prompt, and fallback logic.
- [ ] Update tests to mock the adapter and assert Gemini provider values.

### Task 3: Configuration, documentation, and smoke test

**Files:**
- Create: `.env.example`, `tests/smoke_gemini.py`
- Replace: legacy smoke test with `tests/smoke_gemini.py`
- Modify: `setup.md`

- [ ] Document only `GEMINI_API_KEY` and `GEMINI_MODEL` with placeholders.
- [ ] Rename and update smoke validation without printing keys.
- [ ] Verify `.env` ignore coverage and remove legacy terminology.

### Task 4: Verification

**Files:**
- Test: all server tests and available lint/type/build scripts.

- [ ] Run targeted adapter/service tests, then full tests.
- [ ] Run configured lint, type check, and production build commands when available.
- [ ] Search the server for prohibited legacy configuration and transport references.
- [ ] Record results and any unavailable project tooling.
