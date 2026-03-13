import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRecord, isTask, isProject, isTag, isFolder, isPerspective,
  pad, relativeDate, shortDate, renderTable,
  formatTaskTable, formatProjectTable, formatTagTable,
  formatFolderTable, formatPerspectiveTable, formatKeyValue,
} from '../output.js';
import type { Task, Project, Tag, Folder, Perspective } from '../../types.js';

// ── test fixtures ──

const baseTask: Task = {
  id: 'task-1',
  name: 'Test Task',
  note: null,
  completed: false,
  dropped: false,
  effectivelyActive: true,
  flagged: false,
  project: 'My Project',
  tags: ['work', 'urgent'],
  defer: null,
  due: null,
  estimatedMinutes: null,
  completionDate: null,
  added: '2025-01-15T10:00:00Z',
  modified: '2025-01-15T10:00:00Z',
};

const baseProject: Project = {
  id: 'proj-1',
  name: 'Test Project',
  note: null,
  status: 'active',
  folder: 'Work',
  sequential: false,
  taskCount: 10,
  remainingCount: 5,
  tags: ['office'],
};

const baseTag: Tag = {
  id: 'tag-1',
  name: 'Work',
  taskCount: 10,
  remainingTaskCount: 5,
  added: '2023-01-01T00:00:00Z',
  modified: '2023-06-01T00:00:00Z',
  lastActivity: '2025-01-01T00:00:00Z',
  active: true,
  status: 'active',
  parent: null,
  children: ['Important', 'Low'],
  allowsNextAction: true,
};

const baseFolder: Folder = {
  id: 'folder-1',
  name: 'Work',
  status: 'active',
  effectivelyActive: true,
  parent: null,
  projectCount: 3,
  remainingProjectCount: 2,
  folderCount: 1,
  children: [],
};

const basePerspective: Perspective = {
  id: 'Inbox',
  name: 'Inbox',
};

// ── type guards ──

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord('string')).toBe(false);
    expect(isRecord([])).toBe(false);
  });
});

describe('isTask', () => {
  it('identifies task objects', () => {
    expect(isTask(baseTask)).toBe(true);
  });

  it('rejects non-task objects', () => {
    expect(isTask(baseProject)).toBe(false);
    expect(isTask(baseTag)).toBe(false);
    expect(isTask({})).toBe(false);
    expect(isTask({ id: '1', name: 'x' })).toBe(false);
  });
});

describe('isProject', () => {
  it('identifies project objects', () => {
    expect(isProject(baseProject)).toBe(true);
  });

  it('rejects non-project objects', () => {
    expect(isProject(baseTask)).toBe(false);
    expect(isProject(baseTag)).toBe(false);
    expect(isProject({})).toBe(false);
  });

  it('does not misidentify tags as projects', () => {
    expect(isProject(baseTag)).toBe(false);
  });
});

describe('isTag', () => {
  it('identifies tag objects', () => {
    expect(isTag(baseTag)).toBe(true);
  });

  it('rejects non-tag objects', () => {
    expect(isTag(baseTask)).toBe(false);
    expect(isTag(baseProject)).toBe(false);
    expect(isTag({})).toBe(false);
  });
});

describe('isFolder', () => {
  it('identifies folder objects', () => {
    expect(isFolder(baseFolder)).toBe(true);
  });

  it('rejects non-folder objects', () => {
    expect(isFolder(baseTask)).toBe(false);
    expect(isFolder({})).toBe(false);
  });
});

describe('isPerspective', () => {
  it('identifies perspective objects (exactly 2 keys: id and name)', () => {
    expect(isPerspective(basePerspective)).toBe(true);
  });

  it('rejects objects with extra keys', () => {
    expect(isPerspective({ id: '1', name: 'x', extra: true })).toBe(false);
  });

  it('rejects objects missing keys', () => {
    expect(isPerspective({ id: '1' })).toBe(false);
    expect(isPerspective({ name: 'x' })).toBe(false);
  });
});

// ── table utilities ──

describe('pad', () => {
  it('pads short strings with spaces', () => {
    expect(pad('hi', 5)).toBe('hi   ');
  });

  it('returns exact-width strings unchanged', () => {
    expect(pad('hello', 5)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    expect(pad('hello world', 5)).toBe('hell…');
  });
});

describe('relativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "-" for null', () => {
    expect(relativeDate(null)).toBe('-');
  });

  it('returns "today" for today', () => {
    expect(relativeDate('2026-03-13T10:00:00Z')).toBe('today');
  });

  it('returns days ago for recent dates', () => {
    expect(relativeDate('2026-03-10T12:00:00Z')).toBe('3d ago');
  });

  it('returns months ago for older dates', () => {
    expect(relativeDate('2026-01-13T12:00:00Z')).toBe('1mo ago');
  });

  it('returns years ago for old dates', () => {
    expect(relativeDate('2024-03-13T12:00:00Z')).toBe('2y ago');
  });

  it('returns future dates with "in" prefix', () => {
    expect(relativeDate('2026-03-20T12:00:00Z')).toBe('in 7d');
    expect(relativeDate('2026-06-13T12:00:00Z')).toBe('in 3mo');
    expect(relativeDate('2027-04-13T12:00:00Z')).toBe('in 1y');
  });
});

describe('shortDate', () => {
  it('returns "-" for null', () => {
    expect(shortDate(null)).toBe('-');
  });

  it('extracts YYYY-MM-DD from ISO string', () => {
    expect(shortDate('2024-08-01T10:30:00Z')).toBe('2024-08-01');
  });
});

describe('renderTable', () => {
  it('renders headers, separator, and data rows', () => {
    const result = renderTable(['NAME', 'AGE'], [['Alice', '30'], ['Bob', '25']]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('NAME');
    expect(lines[0]).toContain('AGE');
    expect(lines[1]).toMatch(/^─+───+$/);
    expect(lines[2]).toContain('Alice');
    expect(lines[3]).toContain('Bob');
  });

  it('adjusts column widths to fit longest content', () => {
    const result = renderTable(['N'], [['LongName']]);
    const lines = result.split('\n');
    // Header is padded to match the longest data cell
    expect(lines[0].length).toBeGreaterThanOrEqual('LongName'.length);
    // Separator matches the column width
    expect(lines[1].length).toBeGreaterThanOrEqual('LongName'.length);
    // Data cell is present
    expect(lines[2]).toContain('LongName');
  });
});

// ── table formatters ──

describe('formatTaskTable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "No tasks found." for empty array', () => {
    expect(formatTaskTable([])).toBe('No tasks found.');
  });

  it('shows flagged indicator ★', () => {
    const flagged = { ...baseTask, flagged: true };
    const result = formatTaskTable([flagged]);
    expect(result).toContain('★');
  });

  it('shows overdue indicator !', () => {
    const overdue = { ...baseTask, due: '2020-01-01T00:00:00Z' };
    const result = formatTaskTable([overdue]);
    expect(result).toContain('!');
    expect(result).toContain('OVERDUE');
  });

  it('shows project name and tags', () => {
    const result = formatTaskTable([baseTask]);
    expect(result).toContain('My Project');
    expect(result).toContain('#work');
    expect(result).toContain('#urgent');
  });

  it('shows task count footer', () => {
    const result = formatTaskTable([baseTask, { ...baseTask, id: 'task-2', name: 'Task 2' }]);
    expect(result).toContain('2 tasks');
  });
});

describe('formatProjectTable', () => {
  it('returns "No projects found." for empty array', () => {
    expect(formatProjectTable([])).toBe('No projects found.');
  });

  it('shows project details', () => {
    const result = formatProjectTable([baseProject]);
    expect(result).toContain('Test Project');
    expect(result).toContain('active');
    expect(result).toContain('Work');
    expect(result).toContain('5');
    expect(result).toContain('10');
    expect(result).toContain('#office');
  });

  it('shows "-" for missing folder', () => {
    const noFolder = { ...baseProject, folder: null };
    const result = formatProjectTable([noFolder]);
    const lines = result.split('\n');
    const dataLine = lines[2];
    expect(dataLine).toContain('-');
  });
});

describe('formatTagTable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "No tags found." for empty array', () => {
    expect(formatTagTable([])).toBe('No tags found.');
  });

  it('shows tag details', () => {
    const result = formatTagTable([baseTag]);
    expect(result).toContain('Work');
    expect(result).toContain('10');
    expect(result).toContain('5');
    expect(result).toContain('active');
    expect(result).toContain('1y ago');
    expect(result).toContain('1 tags');
  });
});

describe('formatFolderTable', () => {
  it('returns "No folders found." for empty array', () => {
    expect(formatFolderTable([])).toBe('No folders found.');
  });

  it('shows folder hierarchy with indentation', () => {
    const nested: Folder = {
      ...baseFolder,
      children: [{
        ...baseFolder,
        id: 'folder-2',
        name: 'Subproject',
        parent: 'Work',
        children: [],
      }],
    };
    const result = formatFolderTable([nested]);
    expect(result).toContain('Work');
    expect(result).toContain('  Subproject');
  });
});

describe('formatPerspectiveTable', () => {
  it('returns "No perspectives found." for empty array', () => {
    expect(formatPerspectiveTable([])).toBe('No perspectives found.');
  });

  it('lists perspective names', () => {
    const result = formatPerspectiveTable([basePerspective, { id: 'Flagged', name: 'Flagged' }]);
    expect(result).toContain('Inbox');
    expect(result).toContain('Flagged');
    expect(result).toContain('2 perspectives');
  });
});

describe('formatKeyValue', () => {
  it('renders flat key-value pairs', () => {
    const result = formatKeyValue({ total: 10, active: 5 });
    expect(result).toBe('total: 10\nactive: 5');
  });

  it('renders arrays as indented lists', () => {
    const result = formatKeyValue({ items: [{ name: 'A', count: 1 }] });
    expect(result).toContain('items:');
    expect(result).toContain('  - name: A, count: 1');
  });

  it('renders non-object array items inline', () => {
    const result = formatKeyValue({ tags: ['work', 'home'] });
    expect(result).toContain('  - work');
    expect(result).toContain('  - home');
  });
});
