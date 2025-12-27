import type { Task } from '../types.js';

export function formatEstimate(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function isTaskOverdue(task: Task): boolean {
  if (!task.due || task.completed) return false;
  return new Date(task.due) < new Date();
}

export function formatTags(tags: string[], separator: string = ' '): string {
  return tags.map((t) => `#${t}`).join(separator);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
