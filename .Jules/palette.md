# Palette's UX Journal

Critical UX and accessibility learnings for this repository.

## 2026-07-31 - Interactive Response Feedback & Screen-Reader Focus States in AI Panels
**Learning:** Action buttons (like Copy, Read Aloud, Helpful) below AI response cards and input textareas often omit ARIA labels, focus-visible indicators, and active feedback states, reducing accessibility and leaving user clicks unacknowledged.
**Action:** Always pair action icons with dynamic `aria-label`, `aria-pressed`, `focus-visible:ring-2`, and visual active states (e.g. filled icons and toggle background highlights).
## 2026-07-31 - Interactive Direct Page Jump, Error Recovery & Accessible Touch Targets
**Learning:** Document viewers and AI panels often lack direct keyboard page jump options, leaving keyboard users forced to navigate through dozens of pages manually. Furthermore, PDF rendering errors without retry triggers create dead ends, sub-44px touch targets frustrate mobile users, and nested card icons miss focus rings (`group-focus-visible`).
## 2026-07-31 - Live Region Stream Announcements & Prompt Clear Affordance
**Learning:** AI chat panels and quiz feedback boxes often render dynamically updated content without ARIA live regions (`role="log" aria-live="polite"` or `role="status" aria-live="assertive"`), leaving screen reader users unaware of streaming answers or instant quiz evaluations. Additionally, textareas lacking quick-clear prompt affordances force users to perform manual backspacing.
## 2026-07-31 - Batch Toolbar Focus Rings, Query Clear Affordance & Keyboard Prompt Clearing
**Learning:** Drawer batch toolbars and quiz remediation options often lack explicit focus-visible rings (`focus-visible:ring-2`), missing ARIA labels on trash/clear icons, low contrast helper labels (< 4.5:1 ratio), and Escape key input handling that closes panels instead of clearing typed text first.
**Action:** 1. Ensure all drawer batch actions have `focus-visible:ring-2` focus rings. 2. Provide `X` clear search/prompt buttons with `aria-label`. 3. Intercept `Esc` key in prompt textareas when text is present to clear content before panel closure. 4. Maintain WCAG AA contrast (≥ 4.5:1) on secondary helper labels.
