# OpenCode Code Reference

Approved scope: read-only VS Code style explorer for OpenCode Desktop 2.2.5. The user explicitly requested development of all eight brainstormed features. No text editing, saving, automatic prompt submission, or model calls.

## Experience
Side panel with a lazy file tree, file tabs, syntax-highlighted selectable code, reference basket and history. Ctrl+P finds paths; project search finds text. Right click or a keyboard shortcut adds selected lines to the basket. Each reference has a note, stable code snapshot, workspace, path and range. References may be expanded by surrounding lines. Two references can populate comparison or relationship questions without submitting them.

## Integration
Use the experimental GUI SDK pinned to 2.2.5 and Solid. Read files through the host's session-scoped Files API; never write files. CodeMirror provides a read-only viewport and selection. Host watchers update code. Host Changes contract supplies change markers and before/after views. Composer notes carry quoted immutable snapshots and plugin links. A session store preserves references and navigation history. Link handling reopens referenced code, including after navigation and app restart. Keep asynchronous operations scoped to the captured session/directory and ignore stale search results.

## Limits and errors
Bound snapshot size and history; reject empty selections and binary files. Large files show an explicit size limit. Missing files and failed searches show recoverable errors. Changed references retain original snapshots and are marked stale; range relocation is best effort and ambiguous matches are never claimed exact. No external project roots are read implicitly.

## Visual design
Operate surface: compact toolbar, muted native OpenCode theme variables, system UI type and monospace code, restrained blue selection. Tree at left, tabs and code at right, collapsible basket below. No promotional decoration. Keyboard focus and Turkish labels throughout.

## Verification
Unit tests for selection boundaries, stale snapshot relocation, safe reference links, limits and serialization. Browser integration tests exercise real CodeMirror selection, tree navigation, multi-reference notes, comparison drafts, stale updates, session isolation and diff views using a host adapter fixture. Typecheck and bundle against the installed SDK. Install locally only after checks, preserving other plugin config.
