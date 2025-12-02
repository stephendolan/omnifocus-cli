import { describe, it, expect } from 'vitest';
import { formatEstimate, isTaskOverdue, formatTags, pluralize } from '../display.js';
import type { Task } from '../../types.js';

describe('formatEstimate', () => {
  it('formats minutes only', () => {
    expect(formatEstimate(30)).toBe('30m');
    expect(formatEstimate(0)).toBe('0m');
    expect(formatEstimate(59)).toBe('59m');
  });

  it('formats hours and minutes', () => {
    expect(formatEstimate(60)).toBe('1h 0m');
    expect(formatEstimate(90)).toBe('1h 30m');
    expect(formatEstimate(120)).toBe('2h 0m');
    expect(formatEstimate(135)).toBe('2h 15m');
  });

  it('handles large values', () => {
    expect(formatEstimate(480)).toBe('8h 0m');
    expect(formatEstimate(525)).toBe('8h 45m');
  });
});

describe('isTaskOverdue', () => {
  const baseTask: Task = {
    id: 'test-id',
    name: 'Test Task',
    completed: false,
    flagged: false,
    tags: [],
    note: null,
    project: null,
    due: null,
    defer: null,
    estimatedMinutes: null,
    completionDate: null,
  };

  it('returns false when task has no due date', () => {
    expect(isTaskOverdue(baseTask)).toBe(false);
  });

  it('returns false when task is completed', () => {
    const completedTask: Task = {
      ...baseTask,
      completed: true,
      due: '2020-01-01T00:00:00Z',
    };
    expect(isTaskOverdue(completedTask)).toBe(false);
  });

  it('returns true when due date is in the past', () => {
    const overdueTask: Task = {
      ...baseTask,
      due: '2020-01-01T00:00:00Z',
    };
    expect(isTaskOverdue(overdueTask)).toBe(true);
  });

  it('returns false when due date is in the future', () => {
    const futureTask: Task = {
      ...baseTask,
      due: '2099-12-31T23:59:59Z',
    };
    expect(isTaskOverdue(futureTask)).toBe(false);
  });
});

describe('formatTags', () => {
  it('formats empty array', () => {
    expect(formatTags([])).toBe('');
  });

  it('formats single tag with hashtag prefix', () => {
    expect(formatTags(['work'])).toBe('#work');
  });

  it('formats multiple tags with default space separator', () => {
    expect(formatTags(['work', 'urgent', 'home'])).toBe('#work #urgent #home');
  });

  it('formats with custom separator', () => {
    expect(formatTags(['work', 'urgent'], ', ')).toBe('#work, #urgent');
  });
});

describe('pluralize', () => {
  it('uses singular form for count of 1', () => {
    expect(pluralize(1, 'task')).toBe('1 task');
    expect(pluralize(1, 'project')).toBe('1 project');
  });

  it('uses plural form for count of 0', () => {
    expect(pluralize(0, 'task')).toBe('0 tasks');
  });

  it('uses plural form for count greater than 1', () => {
    expect(pluralize(2, 'task')).toBe('2 tasks');
    expect(pluralize(100, 'project')).toBe('100 projects');
  });

  it('supports custom plural form', () => {
    expect(pluralize(2, 'child', 'children')).toBe('2 children');
    expect(pluralize(1, 'child', 'children')).toBe('1 child');
  });
});
