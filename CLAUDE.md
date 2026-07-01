# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A single-file static HTML prototype/mockup for "PMS" (`PMS index.html`), plus two planning documents (`REQUIREMENTS_PHASE1.md`, `PMS sitemap.txt`) that describe the *intended* full product. The prototype implements only a subset of what the planning docs describe — treat the requirements/sitemap as the target spec, not as a description of current code.

There is no build system, package manager, server, or database. The prototype is entirely client-side: open `PMS index.html` directly in a browser (or serve it with any static file server) to run it.

## Running / developing

- No install step, no build, no test runner, no linter — there is nothing to `npm install`.
- To preview changes, open `PMS index.html` in a browser (or `open "PMS index.html"` on macOS). A simple static server (e.g. `python3 -m http.server`) also works if needed for testing relative paths.
- External dependencies are loaded via CDN `<script>`/`<link>` tags in `<head>`: Tailwind CSS (`cdn.tailwindcss.com`) and Font Awesome 6.5.0. There is no local CSS/JS toolchain.

## Architecture of `PMS index.html`

Everything — markup, styles, data, and logic — lives in this one file:

- **`<style>` block**: hand-written CSS augmenting Tailwind utility classes (sidebar, cards, modals, badges, comment threads, etc.).
- **HTML body**: a single-page-app shell with a password lock screen (`#lockScreen`), a sidebar + main layout (`#mainApp`) that is shown/hidden via inline `style.display` and Tailwind `hidden` classes rather than client-side routing, and shared modal containers (`#createModal`, `#editModal`) whose fields are populated dynamically depending on what's being created/edited.
- **`<script>` block** (all logic, no modules/bundler):
  - **Sample data generation** (`DOC_TEMPLATES`, `CATEGORY_TEMPLATES`, `generateProjectDocs`): builds a realistic set of markdown-style documents (vision, BRD, architecture, test plans, etc.) for every new project so the UI has content to show. `erpData` is the in-memory seed data: an array of Modules → Projects → Documents.
  - **App state**: plain global `let` variables (`currentModuleId`, `currentProjectId`, `viewingDocId`, `editingDocId`, filter/search state). There is no framework (no React/Vue), no virtual DOM — state changes are followed by manual `render*()` calls that rebuild `innerHTML` for the affected container.
  - **Auth**: a single hardcoded password (`PASSWORD = 'admin123'`) gates a lock screen; there is no real authentication, session, or backend — this is a UI demo only.
  - **Navigation model**: Module → Project → Document, mirrored by functions like `selectModule`, `selectProject`, `openDocPage`, `closeDocView`, `goHome`/`backToProjects`. Screens are toggled by adding/removing the `hidden` class on `#projectArea`, `#docArea`, `#docViewPage`, `#emptyState`.
  - **CRUD**: create flows for Module/Project/Document funnel through one shared modal (`showCreateModuleForm`, `showCreateProjectForm`, `showCreateDocumentForm` → `handleCreateSubmit`, which branches on what's being created). Document editing uses a separate dedicated modal (`openEditModal` → `saveEditDocument`). Document status transitions (Draft → Review → Approved → Archived) go through `changeDocStatus`.
  - **No persistence**: all data lives only in the `erpData` JS array for the lifetime of the page; a reload resets everything to the seed data. There is no `localStorage`/`sessionStorage`/network calls.

## Relationship between the three files

- `PMS index.html` — the actual runnable prototype (current state of the UI).
- `REQUIREMENTS_PHASE1.md` — functional requirements for the MVP (auth, dashboard, project/module/document/task management, admin) written in Vietnamese with `FR-*` IDs. Mentions JWT/NextAuth, RBAC, MongoDB, versioning, and audit logs — none of which exist in the current prototype.
- `PMS sitemap.txt` — the full intended route/page tree (e.g. `/dashboard`, `/projects/:projectId/modules/:moduleId/documents/:docId`, `/admin/*`) and page-by-page field lists, again ahead of what the prototype implements.

When asked to implement a feature, check whether it already exists in `PMS index.html` before assuming it needs to be built from scratch, and cross-reference the relevant `FR-*` section in `REQUIREMENTS_PHASE1.md` or the matching route in `PMS sitemap.txt` for expected fields/behavior.

@AGENTS.md
