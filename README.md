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
- 🏷️ **Tag Analysis** - View tag usage statistics and identify stale tags
- 🔍 **Search** - Full-text search across tasks
- 📊 **JSON Output** - Machine-readable output for automation and scripting
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

## Output Format

All commands output JSON by default:

```bash
# Pretty-printed JSON (default)
of task list

# Compact JSON (single line)
of task list --compact
```

### Working with JSON Output

Use `jq` to filter and transform the JSON output:

```bash
# Count inbox tasks
of inbox list | jq 'length'

# Get task names only
of task list | jq '.[] | .name'

# Get flagged tasks with specific fields
of task list --flagged | jq '.[] | {name, project, due}'

# Find tasks added more than 2 hours ago
of inbox list | jq --arg cutoff "$(date -u -v-2H +%Y-%m-%dT%H:%M:%SZ)" \
  '.[] | select(.added < $cutoff)'

# Count unprocessed inbox items
of inbox list | jq '[.[] | select(.project == null)] | length'
```

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
```

### Tag Commands

#### List Tags

```bash
# List all tags with usage counts
of tag list

# Show tags unused for 30+ days
of tag list --unused-days 30

# Sort by usage (most used first)
of tag list --sort usage

# Sort by activity (most recent first)
of tag list --sort activity

# Only count active (incomplete) tasks
of tag list --active-only
```

#### Tag Statistics

```bash
# Show comprehensive tag usage statistics
of tag stats
```

Displays total tag counts, average tasks per tag, most/least used tags, and stale tags.

#### Create Tag

```bash
# Create a new tag
of tag create "New Tag"

# Create a nested tag (child of existing tag)
of tag create "Child Tag" --parent "Parent Tag"
```

#### View Tag

```bash
# View tag details by name
of tag view "Tag Name"

# View tag by ID (always unique)
of tag view "kXu3B-LZfFH"

# View nested tag using path syntax
of tag view "Parent/Child"
```

If multiple tags share the same name in different hierarchies, use the full hierarchical path or tag ID. The command will show available paths if the name is ambiguous.

#### Update Tag

```bash
# Rename a tag
of tag update "Old Name" --name "New Name"

# Deactivate a tag
of tag update "Tag Name" --inactive

# Reactivate a tag
of tag update "Tag Name" --active

# Update nested tag using path
of tag update "Parent/Child" --name "New Name"
```

#### Delete Tag

```bash
# Delete a tag by name
of tag delete "Tag Name"

# Delete using alias
of tag rm "Tag Name"

# Delete nested tag using path
of tag delete "Parent/Child"
```

## Command Reference

### Global Options

- `-h, --help` - Show help for any command
- `-V, --version` - Show version number
- `--compact` - Compact JSON output (single line)

### Task Filters

- `-f, --flagged` - Show only flagged tasks
- `-p, --project <name>` - Filter by project name
- `-t, --tag <name>` - Filter by tag name
- `-c, --completed` - Include completed tasks

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

### Tag Options

**List options:**
- `-u, --unused-days <days>` - Show tags unused for N days
- `-s, --sort <field>` - Sort by: name, usage, activity (default: name)
- `-a, --active-only` - Only count active (incomplete) tasks

**Create/Update options:**
- `-p, --parent <name>` - Create as child of parent tag (create only)
- `-n, --name <name>` - Rename tag (update only)
- `-a, --active` - Set tag as active (update only)
- `-i, --inactive` - Set tag as inactive (update only)

## Task Object Schema

Task objects include these fields:

- `id` - Unique identifier
- `name` - Task name
- `note` - Notes (or null)
- `completed` - Boolean completion status
- `flagged` - Boolean flagged status
- `project` - Project name (null for inbox items)
- `tags` - Array of tag names
- `defer` - Defer date in ISO format (or null)
- `due` - Due date in ISO format (or null)
- `estimatedMinutes` - Time estimate in minutes (or null)
- `completionDate` - Completion timestamp (or null)
- `added` - Creation timestamp (or null)
- `modified` - Last modification timestamp (or null)

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
of project list

# Review flagged items
of task list --flagged

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

### Tag Management

```bash
# View all tags with usage stats
of tag list

# Find stale tags not used in 60+ days
of tag list --unused-days 60

# See most used tags
of tag list --sort usage

# View recently active tags
of tag list --sort activity

# Get comprehensive tag statistics
of tag stats

# Create a new tag
of tag create "Urgent"

# Create nested tags for organization
of tag create "Work Meetings" --parent "Work"
of tag create "Personal Meetings" --parent "Personal"

# View a specific tag (with hierarchical path if needed)
of tag view "Work/Work Meetings"

# Rename a stale tag
of tag update "Old Project" --name "Archived Project"

# Deactivate unused tags
of tag update "Archived Project" --inactive

# Delete completely unused tags
of tag delete "Obsolete Tag"
```

## Requirements

- macOS (OmniFocus is Mac-only)
- OmniFocus installed and running
- Node.js 18+

## How It Works

The CLI uses JavaScript for Automation (JXA) to communicate directly with OmniFocus, providing fast, direct access without external services.

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

Use the exact task name or ID. Task IDs are included in the JSON output of all list commands.

### Date Format

Use ISO format for dates: `YYYY-MM-DD` or full ISO strings like `2024-01-15T10:00:00`.

## License

MIT
