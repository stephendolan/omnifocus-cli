# OmniFocus CLI Examples

## Quick Start

After installing with `npm link`, you can use the `of` command:

```bash
# Show help
of --help

# Show help for a specific command
of task --help
of project --help
```

## Common Workflows

### Morning Routine

```bash
# Check how many items are in your inbox
of inbox count

# List inbox items
of inbox list

# List all flagged tasks (your priorities)
of task list --flagged

# List tasks from a specific project
of task list --project "Work"
```

### Adding Tasks

```bash
# Quick inbox task
of task create "Email John about the meeting"

# Task with a project
of task create "Review pull request #123" --project "Development"

# Task with due date and flag
of task create "Submit report" \
  --project "Work" \
  --due "2024-01-20" \
  --flagged

# Task with all the bells and whistles
of task create "Prepare presentation" \
  --project "Marketing" \
  --tag "presentation" \
  --tag "urgent" \
  --due "2024-01-25" \
  --defer "2024-01-20" \
  --estimate 120 \
  --flagged \
  --note "Include Q4 metrics and customer testimonials"
```

### Managing Tasks

```bash
# View task details
of task view "Submit report"

# Mark task as complete
of task update "Email John" --complete

# Flag a task
of task update "Review code" --flag

# Change task name
of task update "Old name" --name "New name"

# Move task to different project
of task update "Some task" --project "Different Project"

# Add tags to a task
of task update "Design mockup" --tag "design" "review"

# Update multiple properties at once
of task update "Important task" \
  --name "Very important task" \
  --flag \
  --due "2024-01-30" \
  --project "Critical"
```

### Working with Projects

```bash
# List all active projects
of project list

# List projects in a specific folder
of project list --folder "Work"

# Create a new project
of project create "Website Redesign"

# Create a sequential project in a folder
of project create "Onboarding Process" \
  --folder "HR" \
  --sequential \
  --tag "process"

# View project details
of project view "Website Redesign"
```

### Searching

```bash
# Search for tasks containing "meeting"
of search "meeting"

# Search with verbose output
of search "report" -v

# Search is case-insensitive and searches both names and notes
of search "documentation"
```

### Filtering Tasks

```bash
# Show only flagged tasks
of task list --flagged

# Show tasks in a specific project
of task list --project "Work"

# Show tasks with a specific tag
of task list --tag "urgent"

# Show completed tasks too
of task list --completed

# Combine filters
of task list --project "Work" --flagged

# Verbose output for more details
of task list --project "Work" -v
```

### Weekly Review

```bash
# Check inbox
of inbox count
of inbox list

# Review all projects
of project list -v

# Check flagged items
of task list --flagged -v

# Look for tasks in specific contexts
of task list --tag "waiting"
of task list --tag "phone"

# Search for topics you're tracking
of search "follow up"
of search "quarterly"
```

### GTD Workflow

```bash
# Capture: Add items to inbox quickly
of task create "Call dentist"
of task create "Review expense report"

# Clarify: Process inbox items
of inbox list

# Organize: Move items to projects and add metadata
of task update "Call dentist" \
  --project "Personal" \
  --tag "phone" \
  --estimate 10

# Review: Check your system
of task list --flagged
of project list -v

# Engage: Do the work (use the app!)
```

## Advanced Usage

### Task Management with IDs

```bash
# Get task ID in verbose mode
of task list -v | grep "ID:"

# Use ID for precise updates (no ambiguity)
of task update "kXu3B-LZfFH" --complete

# View by ID
of task view "kXu3B-LZfFH"

# Delete by ID
of task delete "kXu3B-LZfFH"
```

### Working with Dates

```bash
# ISO date format (recommended)
of task create "Tax deadline" --due "2024-04-15"

# With time
of task create "Meeting" --due "2024-01-20T14:00:00"

# Defer dates (hide until date)
of task create "Review in 2 weeks" --defer "2024-02-05"

# Both defer and due
of task create "Project milestone" \
  --defer "2024-02-01" \
  --due "2024-02-15"
```

### Shell Aliases

Add to your `.zshrc` or `.bashrc`:

```bash
# Quick shortcuts
alias ofi="of inbox count"
alias ofl="of task list --flagged"
alias ofa="of task create"

# Context-specific views
alias ofw="of task list --project Work"
alias ofp="of task list --tag phone"
alias ofe="of task list --tag errands"
```

Then use:

```bash
ofi              # Check inbox
ofl              # List flagged tasks
ofa "New task"   # Create task
ofw              # List work tasks
```

### Combining with Other Tools

```bash
# Count flagged tasks
of task list --flagged | grep -c "⭐"

# Export task list to file
of task list --project "Work" > work-tasks.txt

# Search and pipe to less
of search "documentation" | less

# Quick project summary
of project list | grep "●"
```

## Tips

1. **Use autocomplete**: Most shells support tab completion for commands
2. **Use aliases**: Shorten common commands (see above)
3. **Use IDs for ambiguous names**: When multiple tasks have similar names
4. **Verbose mode**: Use `-v` to see full details including IDs
5. **Date format**: Stick to ISO format (`YYYY-MM-DD`) for consistency
6. **Tags**: Use multiple tags to organize tasks by context, energy level, etc.
7. **Sequential projects**: Use `--sequential` for projects where tasks must be done in order
8. **Regular reviews**: Use `of inbox count` and `of task list --flagged` daily
