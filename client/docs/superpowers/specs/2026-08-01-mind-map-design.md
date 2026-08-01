# Mind map drawer design

## Scope

Add an AI-generated, interactive mind map for the current lecture without changing the document viewer, note drawer, or tutor behaviour.

## UI

The centered document toolbar removes its overflow menu and adds a secondary ghost `Sơ đồ tư duy` button immediately after `Mở Note`. The button toggles a right-side drawer styled consistently with the notes drawer.

The drawer includes scope controls (current page, selected pages, whole lecture), depth controls (overview, normal, detailed), generation feedback, a responsive React Flow canvas, and actions to regenerate, fit the graph, export PNG, and download JSON.

## Data flow

1. The app gathers text already extracted by `SlideViewer`, filtered by selected scope.
2. `mindMapRequest` posts that text, the document id, scope, depth, and a strict JSON-only prompt to `POST /api/documents/:docId/mind-map`.
3. `mindMapParser` validates and normalizes the hierarchical response (`id`, `title`, `summary`, `pageReferences`, `children`).
4. `mindMapFlow` turns the tree into React Flow nodes and smooth animated edges, using dagre for an outward, left-to-right layout.
5. The drawer renders with custom nodes, controls, minimap, background, fit view, hover/focus styles and recursive collapse/expand.

## Caching and interaction

`mindMapCache` persists valid JSON in `localStorage`, keyed by document id, content fingerprint, scope, selected pages, and depth. On cache hit the graph opens immediately. Node selection calls the existing PDF-page navigation callback using its first page reference.

## API contract

Request:

```json
{
  "content": [{ "page": 1, "text": "..." }],
  "scope": "whole_lecture",
  "depth": "normal",
  "prompt": "Return hierarchical JSON only..."
}
```

Response body is a root node or `{ "mind_map": rootNode }`, where every node has `id`, `title`, `summary`, `page_references`, and `children`. The client accepts equivalent camelCase page-reference naming and rejects malformed structures.

## Resilience and testing

Loading transitions read: `Chưa tạo`, `Đang phân tích PDF...`, `AI đang xây dựng sơ đồ...`, and `React Flow render`. Skeleton nodes show while generating. API failure remains isolated to the drawer. Unit tests cover parser validation, cache keys/cache round trips, and tree-to-flow conversion. Typecheck and tests must pass.
