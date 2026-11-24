# AGENTS.md

`of` is a CLI and MCP server for OmniFocus on macOS. Every command prints JSON for scripts and agents; that output is the contract.

## How a call reaches OmniFocus

`src/omni/runtime.ts` holds the code that runs inside OmniFocus, as type-checked functions. `composeOmniScript()` in `src/lib/bridge.ts` sends an operation's source text with its arguments as JSON, `wrapOmniScript()` wraps that in a JXA shim that hands it to OmniFocus's `evaluateJavascript`, and `runOsascript()` pipes the result to `osascript -l JavaScript -` over stdin, so concurrent calls, such as parallel MCP tool calls, never share a script file.

- A runtime function reaches OmniFocus as its own text. It can use its parameters, other exported functions in `runtime.ts`, Omni Automation globals, and ECMAScript built-ins. Keep `runtime.ts` to exported functions and types: an import, a module-level constant, or an unexported helper exists in Node and is a ReferenceError inside OmniFocus.
- `tsc -p src/omni`, part of `bun run typecheck`, checks the runtime against `src/types/omniautomation.d.ts` with no Node or Bun types in scope, so a property or global OmniFocus lacks is a type error. Declare a Database global in `src/omni/globals.ts` before using it.
- Compare database objects with `sameObject()`, by ID. Wrapper identity is not guaranteed: OmniFocus returns an Inbox wrapper distinct from the `inbox` global.
- An operation returns plain data and reports a failure with `fail(code, message)`. `invoke()` turns either into a JSON envelope; `decodeOmniResult()` throws an `OmniFocusError` whose code sets the status in `src/lib/errors.ts`. An exception without a code, such as a TypeError from a wrong API call, surfaces as `script_error`.
- Every `OmniFocusError`, argument error, and consent error states its `changes`: `none`, `unknown`, or `partial`. `OmniFocus.read()` reports `none` for any failure; call `OmniFocus.write()` for an operation that changes the database, and mark a failure whose writes were all undone with `unchanged()`.
- `invoke()` skips a script that starts after its caller's deadline, so a call left queued in a blocked OmniFocus does nothing when the queue drains. `createExecutionGate()` in `src/lib/execution-gate.ts` stops an MCP server from sending calls for 30 seconds after one times out.
- A write goes through `commit()` as a list of `ReversibleWrite`s, each of which applies a field, reads it back, and can undo itself. Add a field as another write so it inherits verification and restoration. Completing and dropping a task run last as `CheckedWrite`s: they are read back but never undone, so a failure there reports `partial_write`.
- `resolveTask`, `resolveProject`, and `resolveFolder` take an ID or a name exactly one object carries. A shared name fails as `ambiguous` with candidates' IDs, including a finished task that shares a remaining task's name. `findTag` also accepts `Parent/Child` paths. Filters use `tagsMatching` and `foldersMatching`, which accept a shared name and fail only when nothing matches, so an empty list never stands for a missing object.
- `flattenedTasks` includes each project's root task, which carries the project's ID and name. `isProjectRoot()` identifies it; task operations may edit its fields and refuse to move, reorder, complete, drop, or delete it.
- OmniFocus rewrites a note as it stores it (trimmed, line endings unified), so `noteWrite()` compares notes through `noteText()`. Names are kept as written. A new field whose value OmniFocus may rewrite needs the same treatment, or every write of it fails verification.
- `src/types.ts` derives each result type from the runtime function that produces it.

## Commands and MCP tools

Each `src/commands/*.ts` exports a `createXCommand()`; OmniFocus-backed actions run inside `withErrorHandling()` and print through `outputJson()`. `src/mcp/tools.ts` lists each tool once, with its description, zod schema, read-only flag, and the `OmniFocus` method it calls; the server registers tools from that list and `search_tools` searches it. A new or changed command option belongs in the matching tool's schema and in `README.md` too. Tools register inside `createMcpServer()` because `of mcp --http` (`src/mcp/http.ts`) builds a fresh server per request.

Date options follow `due` and `defer`: the CLI parses them with `parseDateTime()`, rejecting invalid input with a 400 before OmniFocus runs, and an empty value on `update` clears the date. `parseDateTime()` also rejects a date or time that does not exist, which the date library would roll into the next month or day.

The zod schemas in `src/lib/mutations.ts` cover read filters as well as writes, and both the MCP tools and the `OmniFocus` methods parse them, so a value the CLI passes is checked exactly as a tool argument is. Pass a CLI option through even when it is empty, and parse numeric options with `parseNumber()`; dropping an empty value, or reading it as 0, hides the mistake from validation.

`getPerspectiveTasks()` needs an open window and switches the user's front window to the requested perspective. Inbox commands traverse `inbox.apply()` instead, so they work without a window and leave the view alone.

## Process exit and runtime

- End with `process.exitCode`. `process.exit()` kills the process before piped stdout drains, truncating output at about 512 bytes (issue #20); `program.exitOverride()` in `src/cli.ts` stops Commander from exiting for the same reason.
- `dist/cli.js` runs under Node through its `#!/usr/bin/env node` shebang, because Bun drops queued stdout writes on exit. Bun is the dev toolchain only: install, build, and test.

## Testing

- `bun test` is the only runner; tests import from `bun:test`. Several suites run `dist/cli.js`, so build first.
- `fakeOmniFocus()` in `src/lib/__tests__/fixtures/` runs the scripts the bridge composes against an in-memory database that follows the object model in `omniautomation.d.ts`. Reading a property the fake does not model throws, so extend the fake when the runtime reads a new one. The fake encodes what the declarations say, which live acceptance through a listener still has to confirm.
- `built-cli.test.ts` runs the bundled runtime text under Node against that fake, behind the mock `osascript`. It is the check that a bundler change has not broken the scripts OmniFocus receives.
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
