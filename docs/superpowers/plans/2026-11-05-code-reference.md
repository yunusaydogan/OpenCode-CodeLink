# Code Reference Implementation Plan

> Execute inline using executing-plans, with test-first core behavior and final review.

**Goal:** Build all eight approved read-only code reference features in an installable OpenCode Desktop plugin.
**Architecture:** GUI-only Solid plugin, native session file/composer APIs, CodeMirror read-only views, session-persisted snapshots and navigation.
**Tech Stack:** TypeScript, Solid, CodeMirror 6, Vite, Node test runner, Playwright.
**Spec:** docs/superpowers/specs/2026-11-05-code-reference-design.md

## Global Constraints

- Target OpenCode Desktop 2.2.5; experimental GUI API pinned.
- Read-only project access; no model calls or automatic sends.
- Immutable reference snapshots; session isolation; English UI (updated in 0.1.1).

## Task 1: Snapshot and navigation core

Files: src/references.ts, test/references.test.ts.
Interfaces: capture(path, text, from, to), locate(reference, current), expand(reference, current, padding), attachment(reference, origin), parseLink(href).

- [x] Write tests for multiline boundaries, frozen snapshots, stale relocation, size bounds and safe links.
- [x] Run Node tests, observe missing module failure, implement core and rerun green.

## Task 2: Native panel and code viewer

Files: src/gui.tsx, src/panel.tsx, src/editor.tsx, src/state.ts, src/styles.ts, package.json, vite.config.ts.
Interfaces: Panel receives native PanelProps, state is keyed by session + directory; editor takes content, path, reveal and selection callbacks.

- [x] Build browser host fixture and interaction tests before panel implementation.
- [x] Implement lazy explorer, tabs, readonly highlighted editor, context menu, basket, notes, history, live watchers, expand and pair actions.
- [x] Add cancellable path/project search, native change markers, before/after view, plugin link handling and commands.
- [x] Run typecheck and interaction tests; resolve failures without weakening assertions.

## Task 3: Packaging and delivery

Files: scripts/install.mjs, README.md, test/install.test.ts.

- [x] Test config preservation/idempotence against a temporary config.
- [x] Implement local install with config backup, and document commands and limits.
- [x] Run tests, typecheck, bundle and review all changes. Install into the user's OpenCode config and verify package registration without restarting their active app.
