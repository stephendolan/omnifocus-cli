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
```

### Folders

```bash
of folder list                      # List all folders
of folder list --dropped            # Include dropped
of folder view "Work"               # View folder details
```

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

### MCP Server

Run as an MCP server for AI agent integration:

```bash
of mcp                              # stdio, for agents on this Mac
of mcp --http                       # Streamable HTTP at http://127.0.0.1:3939/mcp
of mcp --http 4000                  # Same, on another port
```

HTTP mode listens on 127.0.0.1 and accepts only `localhost` and `127.0.0.1` as the Host. To reach it from other devices on your tailnet, allow the Mac's MagicDNS name and publish the port with `tailscale serve`:

```bash
of mcp --http --allow-host <machine>.<tailnet>.ts.net
tailscale serve --bg --https=8443 http://127.0.0.1:3939
claude mcp add --transport http omnifocus https://<machine>.<tailnet>.ts.net:8443/mcp
```

Full mode is the default (26 tools). Use `--mode read-only` for the 16-tool read-only allowlist; direct calls to excluded tools are rejected, including `get_perspective_tasks` because it changes the front window.

For an authenticated public reverse proxy, require Cloudflare Access JWT validation at the origin:

```bash
of mcp --http 3940 --allow-host omnifocus.example.com --mode full \
  --access-team-domain https://your-team.cloudflareaccess.com \
  --access-audience YOUR_APPLICATION_AUDIENCE
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
