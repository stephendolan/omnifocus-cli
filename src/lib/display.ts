import chalk from 'chalk';
import { format, formatDistanceToNow } from 'date-fns';
import type { Task, Project, Perspective, Tag, TagStats, TaskStats, ProjectStats } from '../types.js';

const PROJECT_STATUS_COLORS = {
  'active': chalk.green,
  'on hold': chalk.yellow,
  'dropped': chalk.red,
} as const;

export function displaySuccessMessage(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function displayWithSuccessMessage<T extends Task | Project | Tag>(
  message: string,
  entity: T,
  displayFn: (entity: T) => void
): void {
  displaySuccessMessage(message);
  console.log();
  displayFn(entity);
}

function displayPerspective(perspective: Perspective): void {
  console.log(`  ${chalk.cyan('▶')} ${chalk.bold(perspective.name)}`);
}

export function displayPerspectiveList(perspectives: Perspective[]): void {
  displayList(perspectives, 'perspective', displayPerspective);
  if (perspectives.length > 0) {
    console.log();
  }
}

function formatEstimate(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function isTaskOverdue(task: Task): boolean {
  if (!task.due || task.completed) return false;
  return new Date(task.due) < new Date();
}

function formatTags(tags: string[], separator: string = ' '): string {
  return tags.map(t => `#${t}`).join(separator);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function displayMetric(label: string, value: string | number, valueColor?: typeof chalk): void {
  const formattedValue = valueColor ? valueColor(value.toString()) : value.toString();
  console.log(chalk.gray(label.padEnd(25)) + formattedValue);
}

function displayTopList(title: string, items: Array<{ name: string; [key: string]: any }>, countKey: string, color: typeof chalk = chalk.cyan): void {
  if (items.length === 0) return;

  console.log();
  console.log(chalk.bold(title));
  items.forEach(item => {
    console.log(`  ${color(item.name)} ${chalk.gray(`(${item[countKey]} ${countKey})`)}`);
  });
}

function displayList<T>(
  items: T[],
  itemName: string,
  displayFn: (item: T, verbose?: boolean) => void,
  verbose = false
): void {
  if (items.length === 0) {
    console.log(chalk.gray(`No ${itemName}s found`));
    return;
  }

  console.log(chalk.bold(`\nFound ${pluralize(items.length, itemName)}:\n`));
  items.forEach(item => displayFn(item, verbose));
}

export function displayTask(task: Task, verbose = false): void {
  const parts: string[] = [];

  parts.push(task.flagged ? chalk.yellow('⭐') : '  ');
  parts.push(task.completed ? chalk.green('✓') : chalk.gray('○'));
  parts.push(chalk.bold(task.name));

  if (task.project) {
    parts.push(chalk.cyan(`[${task.project}]`));
  }

  if (task.tags.length > 0) {
    parts.push(chalk.magenta(formatTags(task.tags)));
  }

  if (task.due) {
    const dueDate = new Date(task.due);
    const dateStr = formatDistanceToNow(dueDate, { addSuffix: true });
    parts.push(isTaskOverdue(task) ? chalk.red(`due ${dateStr}`) : chalk.gray(`due ${dateStr}`));
  }

  if (task.estimatedMinutes) {
    parts.push(chalk.gray(`[${formatEstimate(task.estimatedMinutes)}]`));
  }

  console.log(parts.join(' '));

  if (verbose) {
    if (task.note) {
      console.log(chalk.gray(`  Note: ${task.note}`));
    }
    console.log(chalk.gray(`  ID: ${task.id}`));
    if (task.defer) {
      console.log(chalk.gray(`  Defer: ${format(new Date(task.defer), 'PPP')}`));
    }
    if (task.completionDate) {
      console.log(chalk.gray(`  Completed: ${format(new Date(task.completionDate), 'PPP')}`));
    }
  }
}

export function displayTaskList(tasks: Task[], verbose = false): void {
  displayList(tasks, 'task', displayTask, verbose);
}

export function displayProject(project: Project, verbose = false): void {
  const parts: string[] = [];

  const statusColor = PROJECT_STATUS_COLORS[project.status] || chalk.white;

  parts.push(statusColor('●'));
  parts.push(chalk.bold(project.name));
  parts.push(chalk.gray(`(${project.remainingCount}/${project.taskCount})`));

  if (project.sequential) {
    parts.push(chalk.blue('[sequential]'));
  }

  if (project.folder) {
    parts.push(chalk.cyan(`[${project.folder}]`));
  }

  if (project.tags.length > 0) {
    parts.push(chalk.magenta(formatTags(project.tags)));
  }

  console.log(parts.join(' '));

  if (verbose) {
    if (project.note) {
      console.log(chalk.gray(`  Note: ${project.note}`));
    }
    console.log(chalk.gray(`  ID: ${project.id}`));
    console.log(chalk.gray(`  Status: ${project.status}`));
  }
}

export function displayProjectList(projects: Project[], verbose = false): void {
  displayList(projects, 'project', displayProject, verbose);
}

export function displayTaskDetails(task: Task): void {
  console.log();
  console.log(chalk.bold.underline(task.name));
  console.log();

  console.log(chalk.gray('ID:       ') + task.id);
  console.log(chalk.gray('Status:   ') + (task.completed ? chalk.green('✓ Completed') : chalk.yellow('○ Incomplete')));
  console.log(chalk.gray('Flagged:  ') + (task.flagged ? chalk.yellow('⭐ Yes') : 'No'));

  if (task.project) {
    console.log(chalk.gray('Project:  ') + chalk.cyan(task.project));
  }

  if (task.tags.length > 0) {
    console.log(chalk.gray('Tags:     ') + chalk.magenta(formatTags(task.tags, ', ')));
  }

  if (task.defer) {
    console.log(chalk.gray('Defer:    ') + format(new Date(task.defer), 'PPP p'));
  }

  if (task.due) {
    const dueDate = new Date(task.due);
    const isOverdue = isTaskOverdue(task);
    console.log(chalk.gray('Due:      ') + (isOverdue ? chalk.red(format(dueDate, 'PPP p')) : format(dueDate, 'PPP p')));
  }

  if (task.estimatedMinutes) {
    console.log(chalk.gray('Estimate: ') + formatEstimate(task.estimatedMinutes));
  }

  if (task.completionDate) {
    console.log(chalk.gray('Completed:') + format(new Date(task.completionDate), 'PPP p'));
  }

  if (task.note) {
    console.log();
    console.log(chalk.bold('Note:'));
    console.log(task.note);
  }

  console.log();
}

export function displayProjectDetails(project: Project): void {
  console.log();
  console.log(chalk.bold.underline(project.name));
  console.log();

  const statusColor = PROJECT_STATUS_COLORS[project.status] || chalk.white;

  console.log(chalk.gray('ID:        ') + project.id);
  console.log(chalk.gray('Status:    ') + statusColor(project.status));
  console.log(chalk.gray('Type:      ') + (project.sequential ? chalk.blue('Sequential') : 'Parallel'));
  console.log(chalk.gray('Tasks:     ') + `${project.remainingCount} remaining / ${project.taskCount} total`);

  if (project.folder) {
    console.log(chalk.gray('Folder:    ') + chalk.cyan(project.folder));
  }

  if (project.tags.length > 0) {
    console.log(chalk.gray('Tags:      ') + chalk.magenta(formatTags(project.tags, ', ')));
  }

  if (project.note) {
    console.log();
    console.log(chalk.bold('Note:'));
    console.log(project.note);
  }

  console.log();
}

export function displayTag(tag: Tag, verbose = false): void {
  const parts: string[] = [];

  parts.push(tag.active ? chalk.green('●') : chalk.gray('○'));
  parts.push(chalk.bold(tag.name));
  parts.push(chalk.gray(`(${tag.taskCount} tasks, ${tag.remainingTaskCount} remaining)`));

  if (tag.lastActivity) {
    const activityDate = new Date(tag.lastActivity);
    const dateStr = formatDistanceToNow(activityDate, { addSuffix: true });
    parts.push(chalk.cyan(`active ${dateStr}`));
  } else {
    parts.push(chalk.gray('never used'));
  }

  console.log(parts.join(' '));

  if (verbose) {
    console.log(chalk.gray(`  ID: ${tag.id}`));
    if (tag.added) {
      console.log(chalk.gray(`  Created: ${format(new Date(tag.added), 'PPP')}`));
    }
    if (tag.modified) {
      console.log(chalk.gray(`  Modified: ${format(new Date(tag.modified), 'PPP')}`));
    }
  }
}

export function displayTagList(tags: Tag[], verbose = false): void {
  displayList(tags, 'tag', displayTag, verbose);
}

export function displayTagStats(stats: TagStats): void {
  console.log();
  console.log(chalk.bold.underline('Tag Usage Statistics'));
  console.log();

  displayMetric('Total Tags:', stats.totalTags, chalk.bold);
  displayMetric('Active Tags:', stats.activeTags, chalk.green);
  displayMetric('Tags with Tasks:', stats.tagsWithTasks, chalk.cyan);
  displayMetric('Unused Tags:', stats.unusedTags, chalk.yellow);
  displayMetric('Avg Tasks per Tag:', stats.avgTasksPerTag.toFixed(1));

  displayTopList('Most Used Tags:', stats.mostUsedTags, 'taskCount', chalk.cyan);
  displayTopList('Least Used Tags:', stats.leastUsedTags, 'taskCount', chalk.magenta);

  if (stats.staleTags.length > 0) {
    console.log();
    console.log(chalk.bold('Stale Tags (no activity in 30+ days):'));
    stats.staleTags.slice(0, 10).forEach(t => {
      console.log(`  ${chalk.red(t.name)} ${chalk.gray(`(${t.daysSinceActivity} days)`)}`);
    });
    if (stats.staleTags.length > 10) {
      console.log(chalk.gray(`  ... and ${stats.staleTags.length - 10} more`));
    }
  }

  console.log();
}

export function displayTaskStats(stats: TaskStats): void {
  console.log();
  console.log(chalk.bold.underline('Task Statistics'));
  console.log();

  displayMetric('Total Tasks:', stats.totalTasks, chalk.bold);
  displayMetric('Active Tasks:', stats.activeTasks, chalk.yellow);
  displayMetric('Completed Tasks:', stats.completedTasks, chalk.green);
  displayMetric('Flagged Tasks:', stats.flaggedTasks, chalk.cyan);
  displayMetric('Overdue Tasks:', stats.overdueActiveTasks, chalk.red);
  displayMetric('Completion Rate:', `${stats.completionRate}%`);

  if (stats.avgEstimatedMinutes !== null) {
    displayMetric('Avg Estimate:', `${formatEstimate(stats.avgEstimatedMinutes)} (${stats.tasksWithEstimates} tasks)`);
  }

  displayTopList('Top Projects by Task Count:', stats.tasksByProject, 'taskCount', chalk.cyan);
  displayTopList('Top Tags by Task Count:', stats.tasksByTag, 'taskCount', chalk.magenta);

  console.log();
}

export function displayProjectStats(stats: ProjectStats): void {
  console.log();
  console.log(chalk.bold.underline('Project Statistics'));
  console.log();

  displayMetric('Total Projects:', stats.totalProjects, chalk.bold);
  displayMetric('Active Projects:', stats.activeProjects, chalk.green);
  displayMetric('On Hold Projects:', stats.onHoldProjects, chalk.yellow);
  displayMetric('Dropped Projects:', stats.droppedProjects, chalk.red);
  displayMetric('Sequential Projects:', stats.sequentialProjects, chalk.blue);
  displayMetric('Parallel Projects:', stats.parallelProjects);
  displayMetric('Avg Tasks per Project:', stats.avgTasksPerProject.toFixed(1));
  displayMetric('Avg Remaining per Proj:', stats.avgRemainingPerProject.toFixed(1));
  displayMetric('Avg Completion Rate:', `${stats.avgCompletionRate}%`);

  displayTopList('Projects with Most Tasks:', stats.projectsWithMostTasks, 'taskCount', chalk.cyan);
  displayTopList('Projects with Most Remaining Work:', stats.projectsWithMostRemaining, 'remainingCount', chalk.yellow);

  console.log();
}

export function displayTagDetails(tag: Tag): void {
  console.log();
  console.log(chalk.bold.underline(tag.name));
  console.log();

  const statusColor = tag.status === 'active' ? chalk.green :
                     tag.status === 'on hold' ? chalk.yellow : chalk.red;

  console.log(chalk.gray('ID:                ') + tag.id);
  console.log(chalk.gray('Status:            ') + statusColor(tag.status));
  console.log(chalk.gray('Tasks:             ') + `${tag.remainingTaskCount} remaining / ${tag.taskCount} total`);
  console.log(chalk.gray('Allows Next Action:') + (tag.allowsNextAction ? 'Yes' : 'No'));

  if (tag.parent) {
    console.log(chalk.gray('Parent:            ') + chalk.cyan(tag.parent));
  }

  if (tag.children.length > 0) {
    console.log(chalk.gray('Children:          ') + chalk.cyan(tag.children.join(', ')));
  }

  if (tag.added) {
    console.log(chalk.gray('Created:           ') + format(new Date(tag.added), 'PPP p'));
  }

  if (tag.modified) {
    console.log(chalk.gray('Modified:          ') + format(new Date(tag.modified), 'PPP p'));
  }

  if (tag.lastActivity) {
    const activityDate = new Date(tag.lastActivity);
    const dateStr = formatDistanceToNow(activityDate, { addSuffix: true });
    console.log(chalk.gray('Last Activity:     ') + `${format(activityDate, 'PPP p')} (${dateStr})`);
  }

  console.log();
}
