# OmniFocus CLI Feature Requests for Taskmaster

These features would help Claude better detect stale/stuck tasks without relying solely on memory between runs.

## High Priority

### 1. Task Timestamps
Add creation and modification timestamps to task output:

```bash
of inbox list -v
# Current output:
   ○ Task name
  ID: abc123

# Desired output:
   ○ Task name
  ID: abc123
  Created: 2025-01-13 09:30:00
  Modified: 2025-01-13 14:22:00
  Added to Inbox: 2025-01-13 09:30:00
```

**Why:** Allows Claude to identify truly stale tasks without needing to track everything in memory. Can immediately see tasks that have sat in inbox for days.

### 2. JSON Output Format
Add `--json` flag for machine-readable output:

```bash
of inbox list --json
# Output:
{
  "tasks": [
    {
      "id": "abc123",
      "name": "Task name",
      "status": "incomplete",
      "created": "2025-01-13T09:30:00Z",
      "modified": "2025-01-13T14:22:00Z",
      "addedToInbox": "2025-01-13T09:30:00Z",
      "flagged": false,
      "note": "...",
      "project": null,
      "tags": []
    }
  ]
}
```

**Why:** Much easier for Claude to parse and analyze than text output. Reduces errors from parsing human-readable formats.

### 3. Inbox Statistics
Add command to show inbox health metrics:

```bash
of inbox stats
# Output:
Total tasks: 6
Oldest task: 3 days, 4 hours
Average age: 1 day, 2 hours
Unprocessed (no project): 4
Processed today: 2
```

**Why:** Gives Claude instant context about inbox backlog severity without comparing to previous runs.

## Medium Priority

### 4. Task History/Activity
Show recent activity on a task:

```bash
of task history <task-id>
# Output:
2025-01-13 09:30:00 - Created in Inbox
2025-01-13 14:22:00 - Note added
2025-01-13 15:45:00 - Flagged
```

**Why:** Claude could detect if a task has been "touched" (modified) vs truly ignored.

### 5. Change Detection
Check if tasks have changed since a timestamp:

```bash
of inbox list --changed-since "2025-01-13 12:00:00"
# Only shows tasks created or modified since that time
```

**Why:** Efficiently identify what's actually changed between check-ins without storing full task state in memory.

### 6. Perspective Task Counts
Quick way to get task counts without full output:

```bash
of perspective view "Next" --count-only
# Output: 13
```

**Why:** Lightweight way to track if task counts are changing over time.

## Lower Priority

### 7. Task Age in Output
Include age directly in list views:

```bash
of inbox list -v
   ○ Task name (in inbox for 3h 24m)
```

**Why:** Makes it immediately obvious which tasks are sitting too long.

### 8. Filtering by Age
```bash
of inbox list --older-than "2 hours"
of inbox list --older-than "1 day"
```

**Why:** Claude could specifically target old tasks for nagging.

### 9. Completion Velocity
```bash
of task stats --today
of task stats --this-week

# Output:
Completed today: 8 tasks
Completed this week: 43 tasks
Average completion time: 2.3 days
```

**Why:** Track productivity trends - "You've only completed 2 tasks today, usually you do 8!"

## Implementation Notes

- JSON output is probably the biggest win - makes everything else easier to use
- Timestamps are critical - without them, the agent is flying blind
- All timestamp comparisons should respect work hours (don't count overnight/weekends as "stale time")
- Consider adding ISO8601 format option for timestamps for easier parsing

## Example Enhanced Workflow

With these features, Claude could:

1. Get inbox with JSON + timestamps
2. Immediately identify tasks older than 2 hours
3. Get perspective stats to see if productivity is down
4. Compare task modification dates to detect avoidance patterns
5. Generate targeted, data-driven nags

Instead of:
1. Store entire task state in memory
2. Compare everything manually between runs
3. Hope memory MCP persists correctly
4. Less precise staleness detection
