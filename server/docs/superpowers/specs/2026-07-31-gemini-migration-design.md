# Gemini API Migration Design

## Goal

Replace the legacy AI transport with the official Google Gemini Python SDK without changing public API endpoints, request models, response shapes, evidence validation, caching, or frontend integration.

## Architecture

A focused `app/services/gemini_service.py` adapter will own Gemini configuration and SDK calls. It will convert the existing text and base64 PNG prompt parts into Gemini text and inline-data parts, call `google.genai.Client(...).aio.models.generate_content`, and return only generated text to the summary and tutor services.

The summary service will keep its prompt construction, retry/evidence-validation pipeline, cache semantics, and fallback behavior. The tutor service will keep its existing slide context, fallback response, and API schema. Provider errors will be logged generically and returned through existing safe fallback messages without API keys or raw provider details.

## Configuration

The only AI environment variables are required `GEMINI_API_KEY` and `GEMINI_MODEL`. Application startup validates both and raises a clear error that names only the missing variable(s). `.env.example` and setup documentation use placeholders; the real `.env` remains ignored by Git.

## Compatibility

All endpoints, request/response models, response fields, cache keys, evidence validation, and non-provider fallback behavior remain intact. Successful remote responses report `provider="gemini"`; local/mock responses retain their existing provider values. The app has no streaming endpoint today, so no streaming behavior is changed.

## Testing

Unit tests will mock the Gemini adapter rather than HTTP transport. Coverage will include configuration validation, multimodal payload conversion, summary retries/cache/evidence behavior, tutor context behavior, and the renamed Gemini smoke test. The complete available lint, type, test, and production-build checks will be executed and reported.
