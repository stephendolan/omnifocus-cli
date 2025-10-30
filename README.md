# OmniFocus CLI

[![npm version](https://img.shields.io/npm/v/@stephendolan/omnifocus-cli.svg)](https://www.npmjs.com/package/@stephendolan/omnifocus-cli)
[![npm downloads](https://img.shields.io/npm/dm/@stephendolan/omnifocus-cli.svg)](https://www.npmjs.com/package/@stephendolan/omnifocus-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@stephendolan/omnifocus-cli.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)

A powerful command-line interface for OmniFocus on macOS, inspired by the GitHub CLI (`gh`).

## Features

- 📝 **Task Management** - Create, list, update, and delete tasks
- 📂 **Project Management** - Manage projects and their organization
- 📥 **Inbox Management** - View and count inbox items
- 🔍 **Search** - Full-text search across tasks
- 🎨 **Beautiful Output** - Color-coded, formatted output with icons
- ⚡ **Fast** - Direct OmniFocus integration using JXA

## Installation

```bash
# Install globally
npm install -g @stephendolan/omnifocus-cli

# Or run directly without installing
npx @stephendolan/omnifocus-cli task list
```

### From Source

```bash
git clone https://github.com/stephendolan/omnifocus-cli.git
cd omnifocus-cli
npm install
npm run link  # Build and link globally
```

Now you can use the `of` command anywhere in your terminal.

## Usage

### Task Commands

#### List Tasks

```bash
# List all active tasks
of task list

# List flagged tasks only
of task list --flagged

# Filter by project
of task list --project "Work"

# Filter by tag
of task list --tag "urgent"

# Include completed tasks
of task list --completed

# Show verbose details
of task list -v
```

#### Create a Task

```bash
# Simple task to inbox
of task create "Review pull requests"

# Task with project
of task create "Write documentation" --project "Website"

# Task with multiple options
of task create "Call dentist" \
  --project "Personal" \
  --tag "phone" \
  --due "2024-01-15" \
  --flagged \
  --estimate 15
```

#### Update a Task

```bash
# Mark as completed
of task update "Review pull requests" --complete

# Flag a task
of task update "Call dentist" --flag

# Move to different project
of task update "Write docs" --project "Documentation"

# Update multiple properties
of task update "Email team" \
  --name "Email team about launch" \
  --due "2024-01-20" \
  --flag
```

#### View Task Details

```bash
# View by name
of task view "Review pull requests"

# View by ID
of task view "kXu3B-LZfFH"
```

#### Delete a Task

```bash
of task delete "Old task"
of task rm "Old task"  # alias
```

### Project Commands

#### List Projects

```bash
# List all active projects
of project list

# Filter by folder
of project list --folder "Work"

# Filter by status
of project list --status "on hold"

# Include dropped projects
of project list --dropped

# Show verbose details
of project list -v
```

#### Create a Project

```bash
# Simple project
of project create "Website Redesign"

# Project with folder and tags
of project create "Q1 Planning" \
  --folder "Work" \
  --tag "quarterly" \
  --sequential
```

#### View Project Details

```bash
of project view "Website Redesign"
```

#### Delete a Project

```bash
of project delete "Old Project"
of project rm "Old Project"  # alias
```

### Inbox Commands

```bash
# List inbox items
of inbox list

# Get inbox count
of inbox count
```

### Search

```bash
# Search for tasks
of search "documentation"

# Show verbose results
of search "meeting" -v
```

## Command Reference

### Global Options

- `-h, --help` - Show help for any command
- `-V, --version` - Show version number

### Task Filters

- `-f, --flagged` - Show only flagged tasks
- `-p, --project <name>` - Filter by project name
- `-t, --tag <name>` - Filter by tag name
- `-c, --completed` - Include completed tasks
- `-v, --verbose` - Show detailed information

### Task Options

- `--project <name>` - Assign to project
- `--note <text>` - Add note
- `--tag <tags...>` - Add tags (space-separated)
- `--due <date>` - Set due date (ISO format: YYYY-MM-DD)
- `--defer <date>` - Set defer date (ISO format)
- `--flagged` - Flag the task
- `--estimate <minutes>` - Set time estimate in minutes

### Project Options

- `--folder <name>` - Assign to folder
- `--note <text>` - Add note
- `--tag <tags...>` - Add tags (space-separated)
- `--sequential` - Make it a sequential project
- `--status <status>` - Set status (active, on hold, dropped)

## Output Legend

### Task List

- `⭐` - Flagged task
- `✓` - Completed task
- `○` - Incomplete task
- `[Project]` - Project name (cyan)
- `#tag` - Tags (magenta)
- `due X ago` - Overdue tasks (red)
- `due in X` - Upcoming tasks (gray)
- `[Xh Xm]` - Time estimate (gray)

### Project List

- `●` - Status indicator (green=active, yellow=on hold, red=dropped)
- `(X/Y)` - Remaining/Total tasks
- `[sequential]` - Sequential project indicator (blue)
- `[Folder]` - Folder name (cyan)
- `#tag` - Tags (magenta)

## Examples

### Daily Workflow

```bash
# Check inbox
of inbox count

# List today's tasks
of task list --flagged

# Add a quick task
of task create "Buy groceries" --tag "errands"

# Review project status
of project list
```

### Weekly Review

```bash
# Check all projects
of project list -v

# Review flagged items
of task list --flagged -v

# Search for specific topics
of search "meeting"
```

### Task Management

```bash
# Create a task in a project with details
of task create "Draft quarterly report" \
  --project "Management" \
  --tag "writing" \
  --due "2024-02-01" \
  --estimate 120 \
  --note "Include metrics from Q4 dashboard"

# Complete a task
of task update "Draft quarterly report" --complete

# Reschedule a task
of task update "Team meeting prep" --due "2024-01-22"
```

## Requirements

- macOS (OmniFocus is Mac-only)
- OmniFocus installed and running
- Node.js 18+

## How It Works

The CLI uses JavaScript for Automation (JXA) to communicate directly with OmniFocus via AppleScript. This provides:

- Fast, direct access to your OmniFocus data
- No need for sync or external services
- Full access to OmniFocus features
- Real-time updates

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Link for local testing
npm link
```

## Troubleshooting

### Permission Issues

When you first run a command, macOS will ask for permission to control OmniFocus. Make sure to grant this permission in System Settings > Privacy & Security > Automation.

### Task Not Found

Use the exact task name or ID. For IDs, you can get them using the `-v` (verbose) flag with list commands.

### Date Format

Use ISO format for dates: `YYYY-MM-DD` or full ISO strings like `2024-01-15T10:00:00`.

## License

MIT
