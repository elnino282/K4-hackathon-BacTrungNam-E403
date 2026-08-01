# Mind Map API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the backend API required by the existing mind-map client.

**Architecture:** Add focused Pydantic request/response models, a service that
uses the existing Gemini adapter, and a route in the existing documents router.

**Tech Stack:** FastAPI, Pydantic v2, Google Gemini SDK, unittest.

## Global Constraints

- The API must return the node fields consumed by `client/src/lib/mindMap.ts`.
- Never trust a client-provided AI prompt.
- Preserve the existing Gemini adapter and error-handling conventions.

---

### Task 1: Mind-map endpoint

**Files:**
- Create: `app/schemas/mind_map.py`, `app/services/mind_map_service.py`
- Modify: `app/api/documents.py`
- Test: `tests/test_mind_map_api.py`

- [ ] Write and run a failing API test for `POST /api/documents/lesson-01/mind-map`.
- [ ] Implement strict request models, service generation, response validation, and route error mapping.
- [ ] Run the API test and backend suite.

### Task 2: Client contract regression

**Files:**
- Modify: `client/src/lib/mindMapRequest.ts`, `client/tests/mindMapRequest.test.ts`

- [ ] Assert the exact URL and a payload containing only backend-owned fields.
- [ ] Remove the client-controlled prompt and run the client suite and typecheck.
