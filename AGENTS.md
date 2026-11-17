# AGENTS.md

`of` is a CLI and MCP server for OmniFocus on macOS. Every command prints JSON for scripts and agents; that output is the contract.

## How a call reaches OmniFocus

`src/lib/omnifocus.ts` builds each operation as an Omni Automation script in a template string. `wrapOmniScript()` wraps it in a JXA shim that hands it to OmniFocus's `evaluateJavascript`, and `executeJXA()` pipes that to `osascript -l JavaScript -` over stdin, so concurrent calls, such as parallel MCP tool calls, never share a script file.

- Scripts embed `OMNI_HELPERS`: the serializers plus `findTask`, `findProject`, and `findTag`.
- TypeScript never sees inside a script string. Check each Omni Automation property against `src/types/omniautomation.d.ts`: an unknown property reads as `undefined`, and `JSON.stringify` silently drops it from output.
- User-supplied values enter scripts only through `escapeString()` inside double quotes or through `JSON.stringify()`.
- `findTask` and `findProject` match an ID or exact name and take the first hit, so a duplicated name resolves to whichever task comes first. `findTag` also accepts `Parent/Child` paths and rejects ambiguous names.
- Errors thrown inside a script reach `handleError()` in `src/lib/errors.ts`, which sets the status from the message text: "not found" is 404 and "Multiple" is 400.

## Commands and MCP tools

Each `src/commands/*.ts` exports a `createXCommand()`; OmniFocus-backed actions run inside `withErrorHandling()` and print through `outputJson()`. `src/mcp/server.ts` exposes the same `OmniFocus` methods as tools, so a new or changed command option belongs in the matching tool's zod schema and in `README.md` too. Each tool's description lives twice in that file, in `server.tool()` and in `toolRegistry` (which backs `search_tools`); change both together. Tools register inside `createMcpServer()` because `of mcp --http` (`src/mcp/http.ts`) builds a fresh server per request.

Date options follow `due` and `defer`: the CLI parses them with `parseDateTime()`, rejecting invalid input with a 400 before OmniFocus runs, and an empty value on `update` clears the date.

`getPerspectiveTasks()` needs an open window and switches the user's front window to the requested perspective. Inbox commands traverse `inbox.apply()` instead, so they work without a window and leave the view alone.

## Process exit and runtime

- End with `process.exitCode`. `process.exit()` kills the process before piped stdout drains, truncating output at about 512 bytes (issue #20); `program.exitOverride()` in `src/cli.ts` stops Commander from exiting for the same reason.
- `dist/cli.js` runs under Node through its `#!/usr/bin/env node` shebang, because Bun drops queued stdout writes on exit. Bun is the dev toolchain only: install, build, and test.

## Testing

- `bun test` is the only runner; tests import from `bun:test`. `pipe-truncation.test.ts` runs `dist/cli.js`, so build first.
- Bun's runner turns any `process.exitCode` set during a test into the suite's exit code, even after a reset, so assert exit behavior in a child process.
- CI runs on Ubuntu without `osascript`. Tests must mock the Apple Events bridge or executable; never launch real `osascript` in the test suite.
- `of` on `PATH` is the user's installed release. Build the working tree with `bun run build`; direct `--help` and `--version` checks do not contact OmniFocus.
- Agent contexts (including BB threads and shells under unapproved ancestors) must NEVER probe OmniFocus with `node dist/cli.js`, `osascript`, or JXA. Children inherit TCC responsibility from an ancestor; even an absolute approved Node path can be attributed to the unapproved BB daemon. Two November 2026 consent dialogs wedged all OmniFocus script access until OmniFocus was relaunched.
- Route live reads through the existing localhost MCP listeners. Every read reaches the user's real synced database; `get_perspective_tasks` also switches their window. If a listener times out, stop live calls and leave dialogs untouched.
- The only sanctioned direct consent check is `of doctor` without `--request-consent`. It calls the permission preflight with `askUserIfNeeded=false`, sends no Apple event, and cannot prompt. Never run `of doctor --request-consent` from an agent context.

## Dependencies

- CI and release install with `bun install --frozen-lockfile`: commit `bun.lock` alongside every `package.json` change.
- Resolve new versions with `--minimum-release-age=259200` so nothing published in the last three days lands.
- Biome is v2 (`files.includes` with `!` negations). After bumping it, run `bunx biome migrate --write`.
