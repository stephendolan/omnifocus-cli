import { isTaskOverdue, formatTags } from './display.js';
import type { Task, Project, Tag, Folder, Perspective } from '../types.js';

export interface OutputOptions {
  compact?: boolean;
  json?: boolean;
}

let globalOutputOptions: OutputOptions = {};

export function setOutputOptions(options: OutputOptions): void {
  globalOutputOptions = options;
}

/**
 * Determine whether to use table format.
 * Table is the default when stdout is a TTY (interactive terminal).
 * --json flag or piped/redirected stdout forces JSON output.
 */
function shouldUseTable(): boolean {
  if (globalOutputOptions.json) return false;
  if (globalOutputOptions.compact) return false;
  return process.stdout.isTTY === true;
}

/**
 * Output data as JSON or human-readable table depending on context.
 * Pass a `tableFormatter` to enable table output for a specific data type.
 */
export function outputJson(data: unknown, options: OutputOptions = {}): void {
  const mergedOptions = { ...globalOutputOptions, ...options };

  if (shouldUseTable() && Array.isArray(data)) {
    const formatted = formatArray(data);
    if (formatted !== null) {
      console.log(formatted);
      return;
    }
  }

  if (shouldUseTable() && isRecord(data)) {
    const formatted = formatRecord(data);
    if (formatted !== null) {
      console.log(formatted);
      return;
    }
  }

  const jsonString = mergedOptions.compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  console.log(jsonString);
}

// ── type guards ──

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

function isTask(item: unknown): item is Task {
  return isRecord(item) && 'id' in item && 'name' in item && 'completed' in item && 'flagged' in item;
}

function isProject(item: unknown): item is Project {
  return isRecord(item) && 'id' in item && 'name' in item && 'sequential' in item && 'taskCount' in item;
}

function isTag(item: unknown): item is Tag {
  return isRecord(item) && 'id' in item && 'name' in item && 'taskCount' in item && 'allowsNextAction' in item;
}

function isFolder(item: unknown): item is Folder {
  return isRecord(item) && 'id' in item && 'name' in item && 'projectCount' in item;
}

function isPerspective(item: unknown): item is Perspective {
  return isRecord(item) && 'id' in item && 'name' in item && Object.keys(item as object).length === 2;
}

// ── table rendering ──

/** Pad or truncate a string to fit a column width. */
function pad(str: string, width: number): string {
  if (str.length > width) return str.slice(0, width - 1) + '…';
  return str.padEnd(width);
}

/** Format a relative date string like "3d ago", "2mo ago", "1y ago". */
function relativeDate(isoStr: string | null): string {
  if (!isoStr) return '-';
  const diff = Date.now() - new Date(isoStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) {
    const absDays = Math.abs(days);
    if (absDays < 30) return `in ${absDays}d`;
    if (absDays < 365) return `in ${Math.floor(absDays / 30)}mo`;
    return `in ${Math.floor(absDays / 365)}y`;
  }
  if (days === 0) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Format a short date like "2024-08-01". */
function shortDate(isoStr: string | null): string {
  if (!isoStr) return '-';
  return isoStr.slice(0, 10);
}

/**
 * Render a simple table from rows of strings.
 * First row is treated as the header.
 */
function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxDataWidth);
  });

  const headerLine = headers.map((h, i) => pad(h, widths[i])).join('  ');
  const separator = widths.map(w => '─'.repeat(w)).join('──');
  const dataLines = rows.map(row =>
    row.map((cell, i) => pad(cell, widths[i])).join('  ')
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

// ── formatters for specific data types ──

function formatTaskTable(tasks: Task[]): string {
  if (tasks.length === 0) return 'No tasks found.';

  const headers = ['FLAG', 'NAME', 'PROJECT', 'TAGS', 'DUE', 'ADDED'];
  const rows = tasks.map(t => [
    t.flagged ? '★' : (isTaskOverdue(t) ? '!' : ' '),
    t.name,
    t.project || '-',
    t.tags.length > 0 ? formatTags(t.tags, ', ') : '-',
    t.due ? (isTaskOverdue(t) ? `${shortDate(t.due)} OVERDUE` : shortDate(t.due)) : '-',
    relativeDate(t.added),
  ]);

  return `${renderTable(headers, rows)}\n${tasks.length} tasks`;
}

function formatProjectTable(projects: Project[]): string {
  if (projects.length === 0) return 'No projects found.';

  const headers = ['NAME', 'STATUS', 'FOLDER', 'REMAINING', 'TOTAL', 'TAGS'];
  const rows = projects.map(p => [
    p.name,
    p.status,
    p.folder || '-',
    String(p.remainingCount),
    String(p.taskCount),
    p.tags.length > 0 ? formatTags(p.tags, ', ') : '-',
  ]);

  return `${renderTable(headers, rows)}\n${projects.length} projects`;
}

function formatTagTable(tags: Tag[]): string {
  if (tags.length === 0) return 'No tags found.';

  const headers = ['NAME', 'TASKS', 'REMAINING', 'STATUS', 'PARENT', 'LAST ACTIVITY'];
  const rows = tags.map(t => [
    t.name,
    String(t.taskCount),
    String(t.remainingTaskCount),
    t.status,
    t.parent || '-',
    relativeDate(t.lastActivity),
  ]);

  return `${renderTable(headers, rows)}\n${tags.length} tags`;
}

function formatFolderTable(folders: Folder[]): string {
  if (folders.length === 0) return 'No folders found.';

  const headers = ['NAME', 'STATUS', 'PROJECTS', 'ACTIVE PROJECTS'];
  const result: string[][] = [];

  function flatten(folder: Folder, depth: number) {
    result.push([
      '  '.repeat(depth) + folder.name,
      folder.status,
      String(folder.projectCount),
      String(folder.remainingProjectCount),
    ]);
    for (const child of folder.children) {
      flatten(child, depth + 1);
    }
  }

  for (const f of folders) flatten(f, 0);

  return `${renderTable(headers, result)}\n${folders.length} top-level folders`;
}

function formatPerspectiveTable(perspectives: Perspective[]): string {
  if (perspectives.length === 0) return 'No perspectives found.';

  const headers = ['NAME'];
  const rows = perspectives.map(p => [p.name]);

  return `${renderTable(headers, rows)}\n${perspectives.length} perspectives`;
}

// ── stats formatters ──

function formatKeyValue(obj: Record<string, unknown>, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${prefix}${key}:`);
      for (const item of value) {
        if (isRecord(item)) {
          const parts = Object.entries(item).map(([k, v]) => `${k}: ${v}`);
          lines.push(`${prefix}  - ${parts.join(', ')}`);
        } else {
          lines.push(`${prefix}  - ${item}`);
        }
      }
    } else {
      lines.push(`${prefix}${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

// ── dispatch ──

function formatArray(data: unknown[]): string | null {
  if (data.length === 0) return 'No items found.';

  const first = data[0];
  if (isTask(first)) return formatTaskTable(data as Task[]);
  if (isProject(first)) return formatProjectTable(data as Project[]);
  if (isTag(first)) return formatTagTable(data as Tag[]);
  if (isFolder(first)) return formatFolderTable(data as Folder[]);
  if (isPerspective(first)) return formatPerspectiveTable(data as Perspective[]);

  return null;
}

function formatRecord(data: Record<string, unknown>): string | null {
  // Single task/project/tag view
  if (isTask(data)) return formatTaskTable([data as Task]);
  if (isProject(data)) return formatProjectTable([data as Project]);

  // Simple message like { message: "..." } or { count: N }
  if ('message' in data && typeof data.message === 'string') return data.message as string;
  if ('count' in data && typeof data.count === 'number') return `Count: ${data.count}`;

  // Stats objects and other key-value data
  if ('totalTasks' in data || 'totalProjects' in data || 'totalTags' in data) {
    return formatKeyValue(data);
  }

  return null;
}
