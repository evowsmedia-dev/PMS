# Frontend UI Rules

Design direction:

- Follow `docs/DESIGN_new.md`.
- PMS is enterprise/project-management software: dense, clear, practical, and
  easy to scan.
- Avoid marketing-page composition for in-app work surfaces.
- Apply the clean monochrome foundation: chalk white canvas, graphite/black
  text, hairline gray borders, and one black filled primary action per visual
  region.
- Chromatic color is allowed only as controlled semantic UI feedback for
  status, priority, overdue, blocked, validation, destructive actions, BI
  warnings, and change highlights. Do not use chromatic color as decoration,
  app chrome, brand accent, or arbitrary one-off emphasis.
- Semantic colors must go through shared tokens/components such as
  `src/app/globals.css`, `Badge` variants, and `src/lib/status-style.ts`.
  Avoid raw `red-*`, `amber-*`, `green-*`, `blue-*`, or `yellow-*` Tailwind
  utilities in feature UI unless the value is explicitly a documented token.

Stack:

- Tailwind CSS v4.
- shadcn/ui style primitives in `src/components/ui`.
- Radix UI under the UI components.
- lucide-react icons.

Component rules:

- Reuse existing UI primitives before creating new ones.
- Use lucide icons for buttons where a standard icon exists.
- Keep cards for repeated items, modals, and genuinely framed tools.
- Avoid nesting cards inside cards.
- Use 1px `#e5e5e5` borders as the main separator. Avoid box shadows for
  elevation.
- Use 10px radius for buttons, inputs, and nav items; 14px for cards; 26px for
  tags/badges; 9999px only for true pills.
- Keep controls feature-complete for expected workflows: disabled states, empty
  states, loading/skeleton states, errors, and confirmation for destructive
  actions where appropriate.

Layout rules:

- Use the layout tiers in `.codex/rules/09-layout-responsive.md`. Do not use
  full-width page surfaces by default.
- Reach for `PageShell`, `PageSection`, `PageToolbar`, and
  `ResponsiveTableFrame` before adding one-off layout wrappers.
- Text must not overflow or overlap on mobile or desktop.
- Use stable dimensions for toolbars, boards, grids, counters, and repeated
  tiles so state changes do not cause layout jumps.
- Do not scale font sizes with viewport width.
- Keep UI text letter spacing at `0`; use tight tracking only for intentional
  display-scale headings.
- Default app text should remain readable and compact: body/table content about
  13-14px, paragraph/document prose about 15-16px, badge/metadata 12-13px, and
  page/section headings sized to their surface. Do not use `text-xs` for primary
  table/card/detail content; reserve it for metadata, timestamps, tiny badges,
  or uppercase section labels.

Typography and brand:

- The app-wide sans font is `Google Sans Text`, with fallback stack
  `Google Sans`, `Arial`, `system-ui`, `-apple-system`, `sans-serif`.
- Keep `Geist Mono` only for monospace/code-adjacent UI.
- Show the Tre logo together with the PMS app name in primary app chrome
  whenever the app name is displayed as brand text.

Client/server split:

- Prefer Server Components for data fetching.
- Use Client Components only for interaction, local state, effects, drag/drop,
  browser APIs, or optimistic UI.
