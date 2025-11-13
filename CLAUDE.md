# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CLI tool for OmniFocus on macOS that uses JavaScript for Automation (JXA) to interact with OmniFocus via AppleScript. The CLI provides gh-style commands for managing tasks, projects, inbox, perspectives, and search.

## Essential Commands

### Development Workflow
```bash
npm install                    # Install dependencies
npm run build                  # Build TypeScript to dist/
npm run dev                    # Watch mode for development
npm link                       # Link binary for local testing (creates `of` command)
```

### Testing the CLI
After `npm link`, use `of` command globally:
```bash
of task list                   # List tasks
of project list                # List projects
of inbox count                 # Get inbox count
```

## Architecture

### Core Integration Layer (src/lib/omnifocus.ts)

The `OmniFocus` class is the central integration point:
- **JXA Execution**: Writes JavaScript to temp files and executes via `osascript -l JavaScript`
- **Omni Automation API**: Uses OmniFocus's Omni Automation JavaScript API (formerly JXA)
- **Helper Functions**: `OMNI_HELPERS` constant contains reusable JXA functions for serialization, finding objects, and tag management
- **Script Wrapping**: `wrapOmniScript()` wraps Omni Automation code in the required Application boilerplate
- **Filter Building**: Dynamic filter generation for tasks and projects via `buildTaskFilters()` and `buildProjectFilters()`

### Command Structure

Commands follow Commander.js patterns:
- Each command module exports a `createXCommand()` function returning a configured Command
- Commands use `executeOmniFocusCommand()` helper that handles spinner, OmniFocus instance, and error handling
- All commands output JSON for machine-readable automation

Files:
- `src/index.ts` - Main entry point, registers all commands
- `src/commands/task.ts` - Task CRUD operations
- `src/commands/project.ts` - Project CRUD operations
- `src/commands/inbox.ts` - Inbox list/count
- `src/commands/perspective.ts` - Perspective switching and viewing
- `src/commands/search.ts` - Task search
- `src/commands/tag.ts` - Tag management and statistics

### Type Definitions

Core types in `src/types.ts`:
- `Task` - Includes id, name, completed, flagged, project, tags, defer/due dates, estimates
- `Project` - Status (active/on hold/dropped), folder, sequential flag, task counts
- Filter interfaces for tasks and projects
- Create/update option interfaces

### Omni Automation API Types

`src/types/omniautomation.d.ts` provides TypeScript definitions for OmniFocus's JavaScript API objects like Task, Project, Folder, Tag, Perspective.

## Key Patterns

### JXA Script Execution
1. Build JavaScript string with embedded helper functions
2. Use `escapeString()` for all user input to prevent injection
3. Wrap in `wrapOmniScript()` to add Application boilerplate
4. Write to temp file, execute via osascript, clean up temp file
5. Parse JSON output from serialized OmniFocus objects

### Error Handling
Commands use `executeOmniFocusCommand()` which:
- Shows loading spinner during execution
- Catches errors and outputs error messages to stderr
- Calls `process.exit(1)` on failure
- OmniFocus API errors (like "Task not found") bubble up from JXA execution

### Perspective Tasks
`getPerspectiveTasks()` requires an OmniFocus window to be open because it:
1. Switches window to the specified perspective
2. Traverses the visible content tree
3. Collects Task objects from the tree nodes
4. Uses 60s timeout (longer than default 30s) due to perspective switching delay

## Important Constraints

- **macOS Only**: Uses osascript which is macOS-specific
- **OmniFocus Required**: Must have OmniFocus installed and running
- **Window Requirement**: Perspective viewing requires an OmniFocus window to be open
- **Permissions**: First run requires granting Automation permissions in System Settings
- **ESM Modules**: Uses ES modules (type: "module" in package.json), all imports need .js extensions

## Date Handling

- Accept ISO format strings: `YYYY-MM-DD` or full ISO like `2024-01-15T10:00:00`
- Store and output as ISO strings in Task objects
- Client applications can parse and format dates as needed

## Task/Project Identification

Both `findTask()` and `findProject()` JXA helpers accept:
- Primary key ID (e.g., "kXu3B-LZfFH")
- Exact name match

Commands use "idOrName" pattern for flexible lookups.
