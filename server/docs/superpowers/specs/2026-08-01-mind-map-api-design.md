# Mind Map API Design

## Goal

Provide the missing backend endpoint consumed by the existing mind-map UI.

## Contract

`POST /api/documents/{doc_id}/mind-map` accepts extracted page text, a scope,
and a depth. It returns one validated hierarchical JSON tree with `id`,
`title`, `summary`, `page_references`, and `children` on every node.

## Flow

The route validates the request, the service builds the prompt from supplied
pages, Gemini is requested in JSON mode, and the service validates the
response with Pydantic before returning it. Provider failures return a 502;
invalid model JSON returns a 502 without exposing provider internals.

## Tests

An API regression test proves the client URL no longer returns 404 and a
service test verifies JSON output is normalized and rejected when malformed.
