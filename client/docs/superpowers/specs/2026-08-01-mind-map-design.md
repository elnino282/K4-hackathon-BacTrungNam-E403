# Mind map drawer MVP design

## Goal

Provide an AI-generated mind map for the open PDF. A learner opens the
`Sơ đồ tư duy` drawer, creates a map when one is unavailable, and can return
to the same map instantly on later opens. The feature uses the live FastAPI
mind-map endpoint; it does not use mock data.

## Scope and decisions

- Cache is browser-local (`localStorage`) for this MVP. It is not shared across
  users, browsers, or devices.
- A cache entry is valid only for the same document id, extracted PDF content,
  requested scope, selected page set, and depth. A changed PDF or option makes
  a different key, so the old map is never shown for a different input.
- The existing Express server continues to proxy the live request to FastAPI:
  `POST /api/documents/:docId/mind-map`.
- The drawer remains isolated: request, parse, or render failures do not affect
  the PDF viewer, notes, or tutor.

## User flow

1. The learner clicks `Sơ đồ tư duy` in the document toolbar. A right drawer
   opens.
2. The drawer derives the cache key and reads it immediately.
3. On a valid cache hit, the interactive map renders immediately and shows a
   small `Đã tải từ bộ nhớ` notice. It makes no AI request.
4. On a miss, the empty state explains that no map exists and presents `Tạo sơ
   đồ`.
5. Selecting that action starts one request and a visible, non-fake progress
   sequence: `Đang đọc PDF` while preparing extracted pages; `AI đang phân tích
   chương`; `AI đang xây quan hệ`; and `Đang dựng sơ đồ` after a valid response
   is received.
6. A valid response is cached before the complete interactive map is shown.
7. Closing and reopening the drawer repeats the cache check and therefore
   renders the map immediately.

## API and validation

The request body includes `content: [{ page, text }]`, `scope`, `depth`, and a
strict JSON-only instruction. The client sends only pages selected by scope:
current page, selected pages, or the whole lecture.

The response may be the root object or `{ mind_map: root }`. Every node must
have a stable id, non-empty title, summary, numeric `page_references`, and an
array of children. The parser normalizes snake/camel-case page references,
rejects malformed trees, protects against duplicate ids/cycles, and bounds
tree size/depth before converting it to graph nodes. Invalid output is never
cached.

## Drawer and graph behavior

The drawer contains scope and depth controls, the generation/retry action,
cache notice, clear error state, and an interactive React Flow canvas.

- The canvas supports pointer drag/pan, wheel and control zoom, mini-map, and
  `Fit view`.
- Every non-leaf node has an accessible collapse/expand control. Collapsing
  hides all descendants while retaining the parent; expanding restores them.
- Selecting a node makes it visually distinct, preserves the selection while
  the map is visible, and invokes the existing evidence navigation callback
  with its first valid PDF page reference. The PDF then moves to that page and
  applies its existing temporary evidence highlight behavior.
- `Tạo lại` deletes only the active configuration's cache entry, then begins a
  fresh live request. It does not remove maps for other scopes/depths.
- JSON export downloads the validated current tree. PNG export is out of scope
  for the MVP; the existing print behavior is not presented as an export.

## States and errors

Only one generation may run at a time. While one is active, settings and the
generation button are disabled, the progress animation is announced to screen
readers, and closing the drawer does not cancel the request; a completed,
valid result is still cached.

If page text is not ready, the drawer asks the learner to wait until extraction
finishes and enables retry. A timeout, proxy failure, server error, invalid AI
output, or empty map shows a concise Vietnamese error in the drawer with
`Thử lại`. A failure never replaces a previously displayed valid map and is
never written to the cache. Local-storage failures merely disable persistence;
the generated map remains usable for the open session.

## Module boundaries

- `mindMap.ts`: types, response parser, cache-key input and validation.
- `mindMapCache.ts`: safe local-storage read, write, and delete by exact key.
- `mindMapRequest.ts`: live API request and error normalization.
- `mindMapFlow.ts`: pure tree-to-React-Flow layout, filtering collapsed
  descendants, and selected-node presentation metadata.
- `MindMapFlowNode.tsx`: accessible custom node, page-reference label, and
  collapse control.
- `MindMapDrawer.tsx`: state machine, progress UI, cache lifecycle, and graph
  composition.
- `App.tsx` and `DocumentToolbar.tsx`: provide extracted/selected PDF context,
  drawer open state, and the existing PDF navigation callback.

## Verification

Unit tests cover parsing/normalization and malformed output, deterministic cache
keys and cache deletion, request body and API errors, collapsed graph layout,
and node navigation. Integration-focused component tests cover cache-first
opening, loading states, retry, and active-node navigation. The completed
change must pass `npm test`, `npm run lint`, and `npm run build`.
