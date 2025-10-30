import chalk from 'chalk';
import { format, formatDistanceToNow } from 'date-fns';
import type { Task, Project, Perspective } from '../types.js';

const PROJECT_STATUS_COLORS = {
  'active': chalk.green,
  'on hold': chalk.yellow,
  'dropped': chalk.red,
} as const;

export function displaySuccessMessage(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function displayWithSuccessMessage<T extends Task | Project>(
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
