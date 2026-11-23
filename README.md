# OmniFocus CLI

[![npm version](https://img.shields.io/npm/v/@stephendolan/omnifocus-cli.svg)](https://www.npmjs.com/package/@stephendolan/omnifocus-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line interface for OmniFocus on macOS.

## Installation

```bash
bun install -g @stephendolan/omnifocus-cli
```

Requires [Bun](https://bun.sh) and macOS with OmniFocus installed.

## Quick Start

```bash
of inbox count                              # Check inbox
of task list --flagged                      # Flagged tasks
of task create "Buy groceries"              # Quick capture
of task update "Buy groceries" --complete   # Mark done
```

## Commands

### Tasks

```bash
of task list                        # List active tasks
of task list --flagged              # Flagged tasks only
of task list --project "Work"       # Filter by project
of task list --tag "urgent"         # Filter by tag
of task list --completed            # Include completed

of task create "Name" [options]
  --project <name>                  # Assign to project
  --tag <tags...>                   # Add tags
  --due <YYYY-MM-DD>                # Set due date
  --defer <YYYY-MM-DD>              # Set defer date
  --planned <YYYY-MM-DD>            # Set planned date
  --flagged                         # Flag the task
  --estimate <minutes>              # Time estimate
  --note <text>                     # Add note

of task update <name|id> [options]
  --complete / --incomplete         # Mark completed/incomplete
  --drop / --undrop                 # Mark dropped/restore to active
  --flag / --unflag                 # Toggle flag
  --name <new-name>                 # Rename
  --project/--tag/--due/--defer/--planned  # Same as create

of task view <name|id>              # View details
of task delete <name|id>            # Delete task
```

### Projects

```bash
of project list                     # List active projects
of project list --folder "Work"     # Filter by folder
of project list --status "on hold"  # Filter by status
of project list --dropped           # Include dropped

of project create "Name" [options]
  --folder <name>                   # Assign to folder
  --tag <tags...>                   # Add tags
  --sequential                      # Sequential project
  --note <text>                     # Add note

of project view <name|id>           # View details
of project delete <name|id>         # Delete project
```

### Tags

```bash
of tag list                         # All tags with counts
of tag list --unused-days 30        # Stale tags
of tag list --sort usage            # Most used first
of tag list --sort activity         # Most recent first
of tag list --active-only           # Only count incomplete tasks

of tag stats                        # Usage statistics

of tag create "Name"                # Create tag
of tag create "Child" --parent "Parent"  # Nested tag

of tag view <name|path|id>          # View details
of tag update <name> --name "New"   # Rename
of tag update <name> --inactive     # Deactivate
of tag delete <name>                # Delete tag
```

### Inbox

```bash
of inbox list                       # List remaining inbox tasks and subtasks
of inbox count                      # Count remaining inbox tasks
of inbox add "Task name"            # Add task to inbox
```

### Perspectives

```bash
of perspective list                 # List all perspectives
of perspective view "Forecast"      # View tasks in perspective
of perspective get-rules "Example"  # Read a custom perspective's rule archive
of perspective update-rules "Example" --file definition.json # Replace its rule archive
```

`get_perspective_rules` accepts `{"idOrName":"Example"}`. Its result is
`{"id":"PERSPECTIVE_ID","name":"Example","definition":{...}}`.
`update_perspective_rules` accepts `{"idOrName":"PERSPECTIVE_ID","definition":{...}}`
and returns the same shape. Use the returned stable identifier when names are
ambiguous. Built-in perspectives return an error.

A complete definition is structured JSON, for example:

```json
{
  "archivedFilterRules": [
    {"actionAvailability":"available"},
    {"aggregateType":"none","aggregateRules":[{"actionIsProject":true}]}
  ],
  "archivedTopLevelFilterAggregation":"all"
}
```

Top-level aggregation accepts `all`, `any`, `none`, or `null`; nested groups
require `aggregateType` (`all`, `any`, `none`) and an `aggregateRules` array.
Rule objects must be nonempty. Unknown rule fields survive round trips; the JSON
key `__proto__` is rejected because the validator would discard it. Updates
replace the entire archive, validate structure before contacting OmniFocus, and
restore the original archive on setter errors or readback mismatch. Recovery
failures are reported explicitly. An empty rule array clears all filters.

To write a read result back, extract `.definition` into `definition.json` with
`jq '.definition' perspective.json`; `--file -` accepts a definition on stdin.
Reading is available in read-only mode; updating requires full mode. Both operate
without switching windows. The Omni Automation archive contains filters and
aggregation; grouping, sorting, and layout are separate export-plist settings
with no setters in this API and are preserved. Creating a perspective shell
requires the app. See [perspective rule operations](docs/mcp-operations.md#perspective-rule-archives)
for fidelity checks and failure boundaries.

### Folders

```bash
of folder list                      # List all folders
of folder list --dropped            # Include dropped
of folder view "Work"               # View folder details
of folder create "Work"             # Create or reuse a top-level folder
```

`folder create` matches exact top-level names, including dropped folders. It
returns the folder fields plus `alreadyExisted`: `false` for a new folder and
`true` when reusing one. Nested folders with the same name do not match. The
`create_folder` MCP tool accepts `{ "name": "Work" }` with the same behavior and
is available in full mode only.

### Statistics

```bash
of task stats                       # Task statistics
of project stats                    # Project statistics
of tag stats                        # Tag statistics
```

### Other

```bash
of search "query"                   # Search tasks
```

### Automation consent

```bash
of doctor                           # Check consent without prompting or sending an Apple event
```

The doctor reports `status: "granted"`, `osStatus: 0`, `execPath`, `target`, and
`promptRequested: false` when allowed. Consent failures return a JSON `error`
with `name` (`automation_consent_required` for -1744 or `automation_denied` for
-1743), `statusCode: 403`, `osStatus`, and `execPath`, and exit with code 1.
Every OmniFocus operation runs the same non-prompting preflight before sending
an Apple event. MCP tools return the same typed JSON with `isError: true`.

`of doctor --request-consent` explicitly allows a macOS consent prompt. Use it
only during attended setup in the intended client context. Agent contexts must
never use that flag or probe OmniFocus directly: macOS can attribute child
processes to an unapproved ancestor, and a queued consent dialog can block all
OmniFocus scripting. Route live reads through an approved localhost MCP listener.
The diagnostic `execPath` identifies the CLI runtime; TCC may attribute the call
to an ancestor instead. See [MCP operations](docs/mcp-operations.md).

### MCP Server

Run as an MCP server for AI agent integration:

```bash
of mcp                              # stdio, for agents on this Mac
of mcp --http                       # Streamable HTTP at http://127.0.0.1:3939/mcp
of mcp --http 4000                  # Same, on another port
```

The initialize response advertises an original purple checkmark icon as embedded
128×128 and 64×64 PNG data URIs in `serverInfo.icons`, for both stdio and HTTP.
Set `OMNIFOCUS_MCP_ICON_PNG` to a readable PNG path to use your own icon. The image
is loaded at startup and embedded with its actual dimensions; an unreadable file
or invalid PNG header prevents startup. Clients can load the icon without a
separate image request. Display and caching depend on the client; reconnecting
may refresh its icon.

HTTP mode listens on 127.0.0.1 and accepts only `localhost` and `127.0.0.1` as the Host. To reach it from other devices on your tailnet, allow the Mac's MagicDNS name and publish the port with `tailscale serve`:

```bash
of mcp --http --allow-host <machine>.<tailnet>.ts.net
tailscale serve --bg --https=8443 http://127.0.0.1:3939
claude mcp add --transport http omnifocus https://<machine>.<tailnet>.ts.net:8443/mcp
```

Full mode is the default (29 tools). Use `--mode read-only` for the 17-tool read-only allowlist; direct calls to excluded tools are rejected, including `get_perspective_tasks` because it changes the front window.

For an authenticated public reverse proxy, require Cloudflare Access JWT validation at the origin:

```bash
of mcp --http 3940 --allow-host omnifocus.example.com --mode full \
  --access-team-domain https://example.cloudflareaccess.com \
  --access-audience YOUR_ACCESS_AUDIENCE
```

Both Access options are required together; `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUDIENCE` provide the same configuration through environment variables. JWT validation applies on localhost too. The origin verifies the RS256 signature using the team's rotating JWKS, exact issuer, application audience, and expiry. Without Access configuration, anyone who can reach the listener can use its configured capabilities; keep that listener on a trusted tailnet.

See [MCP operations](docs/mcp-operations.md) for release, health checks, and separate public-listener and tunnel LaunchAgents.

## JSON Output

All commands output JSON. Use `--compact` for single-line output.

```bash
of task list | jq 'length'                    # Count tasks
of task list | jq '.[] | .name'               # Task names
of task list --flagged | jq '.[] | {name, due}'  # Specific fields
```

## Task Schema

```json
{
  "id": "kXu3B-LZfFH",
  "name": "Task name",
  "completed": false,
  "flagged": true,
  "project": "Project Name",
  "tags": ["tag1", "tag2"],
  "due": "2024-01-15T00:00:00.000Z",
  "defer": null,
  "planned": null,
  "estimatedMinutes": 30,
  "note": "Notes here",
  "added": "2024-01-01T10:00:00.000Z",
  "modified": "2024-01-10T15:30:00.000Z",
  "completionDate": null
}
```

## Troubleshooting

**Permission denied**: Grant automation permission in System Settings > Privacy & Security > Automation.

**Task not found**: Use exact name or ID. IDs appear in JSON output.

**Date format**: Use ISO format `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SS`.

## Development

```bash
git clone https://github.com/stephendolan/omnifocus-cli.git
cd omnifocus-cli
bun install
bun run dev     # Watch mode
bun link        # Link globally as `of`
```

## License

MIT

### Structural updates

All MCP argument envelopes reject unknown fields. Updates require at least one
supported change. Validation and reference resolution precede writes; supported
idempotent updates succeed. Write readback mismatches return errors. Reversible
updates attempt verified restoration; lifecycle failures can report a partial
outcome. Read state before retrying after a transport failure.

`update_project.folder` accepts a folder ID or unique exact name; `null` or `""`
moves to the library root. `update_tag.parent` accepts a tag ID, unique name or
path; `null` moves to the tag root. `parentId` is an alias; conflicting parents
and tag cycles fail. `update_task.project` accepts a project ID or unique name;
`null` or `""` moves to the inbox. Omitted placement fields preserve location.

Project create/update accepts `type`: `parallel`, `sequential`, or `single-action`.
`singleActionList` is a boolean alias. Existing `sequential` remains available;
contradictory arguments fail. Converting a single-action list to sequential
requires explicit `type: "sequential"` or `singleActionList: false`. Project
responses include `type`, `singleActionList`, and `folderId`; task responses add
`projectId` and `parentTaskId`, and tag responses add `parentId`.

Project status includes `done`, distinct from `dropped`. Project updates also
accept `completed: true` (done) or `false` (active). Explicit status filters include
matching projects regardless of default inactive exclusions. Existing project
statistics retain their historical `parallelProjects` count, which includes
single-action lists with `sequential: false`.

`update_task.before` and `after` accept exact sibling task IDs and preserve task
identity and descendants. Supply only one; ordering cannot combine with project,
completed, or dropped changes. Anchors must share the immediate container.
Project-scoped `list_tasks` accepts a project ID or unique name and returns native
outline order with filters preserving relative order.

CLI equivalents include `project create/update --type`, `--single-action-list`,
`project update --folder ""`, `tag update --parent`, and `task update --before` or
`--after`. Empty tag parent clears to root. `folder delete` and MCP `delete_folder`
only delete empty folders and require full mode. Custom perspectives retain their
existing `id` field and add stable `identifier`; `get_perspective_tasks.name` also
accepts that identifier and switches the front window.

Repeating-task completion through `update_task` is rejected before any write: its
occurrence-creation semantics require a separate occurrence-aware contract.
