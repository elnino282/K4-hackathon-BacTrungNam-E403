# Palette's UX Journal

Critical UX and accessibility learnings for this repository.

## 2026-07-31 - Interactive Response Feedback & Screen-Reader Focus States in AI Panels
**Learning:** Action buttons (like Copy, Read Aloud, Helpful) below AI response cards and input textareas often omit ARIA labels, focus-visible indicators, and active feedback states, reducing accessibility and leaving user clicks unacknowledged.
**Action:** Always pair action icons with dynamic `aria-label`, `aria-pressed`, `focus-visible:ring-2`, and visual active states (e.g. filled icons and toggle background highlights).
## 2026-07-31 - Interactive Direct Page Jump, Error Recovery & Accessible Touch Targets
**Learning:** Document viewers and AI panels often lack direct keyboard page jump options, leaving keyboard users forced to navigate through dozens of pages manually. Furthermore, PDF rendering errors without retry triggers create dead ends, sub-44px touch targets frustrate mobile users, and nested card icons miss focus rings (`group-focus-visible`).
**Action:** 1. Provide an interactive inline page jump input form with Enter validation. 2. Always include a retry button (`Thử lại / Retry`) with reload state triggers on network/PDF render error fallbacks. 3. Ensure touch targets on floating action bars meet WCAG AA standards (minimum 44x44px padding). 4. Pair card hover states with `group-focus-visible` to support keyboard navigation parity.
