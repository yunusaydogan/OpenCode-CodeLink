# Verification — 2026-11-06

## Directory label regression fix

Confirmed against the running native API that directories are returned as `.git/`, `src/`, `docs/`, etc. Taking the last slash-separated segment produced empty labels. The display-name helper now strips trailing slash/backslash separators without changing the API path used to open directories. The browser fixture now reproduces native trailing-slash paths, including nested folders.

`npm run check`: 15 Node tests and 10 browser tests passed, including native-style directory labels and nested navigation. Typecheck and build passed. OpenCode Desktop was gracefully restarted (new main PID 874223). Its local service reports the plugin active and serves code identical to the rebuilt GUI bundle. Native directory label extraction was verified against that service.

- `npm run check`: PASS. 14 Node tests, TypeScript checking, production GUI bundle, 9 Chromium interaction tests.
- `node test/live-smoke.mjs`: PASS against `/opt/OpenCode/resources/opencode-cli` 2.2.5. A temporary isolated server registered the GUI-only plugin, served its bundle, listed and read files. No model request or modification to user sessions.
- `node scripts/preview.mjs`: light/dark previews rendered without browser errors; both images visually inspected. Dark syntax and selection contrast corrected. These are browser fixture previews, not screenshots of the actual Desktop window.
- `npm run install:local`: registered this project path in `/home/yunus/.config/opencode/opencode.json`. Backup: `opencode.json.bak-1793945055261`. Verified that the only semantic change was adding this plugin path; all prior configuration remains identical.
- Running loopback OpenCode service: plugin `opencode-code-reference` reports **active** and serves the GUI bundle. No Desktop restart or forced window navigation performed.

## Review resolution

Independent code review found no critical issues. Important findings resolved with browser regression tests:

1. Frozen snapshots and before/after views now render independently of current file existence, type or size.
2. Navigation generations prevent delayed reference reads from changing a subsequently opened file. Opening a frozen copy does not wait on the current file.
3. Launching, closing or changing search invalidates previous work. Captured query/mode/session must still match before accepting results.
4. Unused file watches are released. Disposal uses the captured server and project directory, avoiding the routed screen's next session. Native file tabs retain their watches.
5. Reference links preserve workspace directory; native background link navigation is forwarded. Search uses locale-independent case folding.

The review suggested passing `workspaceID` to file search APIs. This does not apply to the installed 2.2.5 client: its `FileReadInput` and `FileListInput` accept only `location.directory`, matching the native file model implementation. No unsupported field was introduced.

## Practical limits

Actual Desktop window interaction has not been automated; native registration and serving are confirmed, while browser interactions are tested through a host fixture. Project text search and history have visible bounds documented in README.md. The basket persists after sending because the public composer API has no sent/detached attachment enumeration; it can be cleared explicitly.
