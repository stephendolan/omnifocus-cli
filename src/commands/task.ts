import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';
import type { TaskFilters, UpdateTaskOptions } from '../types.js';

export function createTaskCommand(): Command {
  const command = new Command('task');
  command.description('Manage OmniFocus tasks');

  command
    .command('list')
    .alias('ls')
    .description('List tasks')
    .option('-f, --flagged', 'Show only flagged tasks')
    .option('-p, --project <name>', 'Filter by project')
    .option('-t, --tag <name>', 'Filter by tag')
    .option('-c, --completed', 'Include completed tasks')
    .action(async (options) => {
      await executeOmniFocusCommand(
        'Loading tasks...',
        (of) => {
          const filters: TaskFilters = {
            includeCompleted: options.completed,
            ...(options.flagged && { flagged: true }),
            ...(options.project && { project: options.project }),
            ...(options.tag && { tag: options.tag }),
          };

          return of.listTasks(filters);
        },
        (tasks) => outputJson(tasks),
        'Failed to load tasks'
      );
    });

  command
    .command('create <name>')
    .description('Create a new task')
    .option('-p, --project <name>', 'Assign to project')
    .option('-n, --note <text>', 'Add note')
    .option('-t, --tag <tags...>', 'Add tags')
    .option('-d, --due <date>', 'Set due date (ISO format)')
    .option('-D, --defer <date>', 'Set defer date (ISO format)')
    .option('-f, --flagged', 'Flag the task')
    .option('-e, --estimate <minutes>', 'Estimated time in minutes', parseInt)
    .action(async (name, options) => {
      await executeOmniFocusCommand(
        'Creating task...',
        (of) => of.createTask({
          name,
          note: options.note,
          project: options.project,
          tags: options.tag,
          due: options.due,
          defer: options.defer,
          flagged: options.flagged,
          estimatedMinutes: options.estimate,
        }),
        (task) => outputJson(task),
        'Failed to create task'
      );
    });

  command
    .command('update <idOrName>')
    .description('Update an existing task')
    .option('-n, --name <name>', 'New name')
    .option('--note <text>', 'New note')
    .option('-p, --project <name>', 'Move to project')
    .option('-t, --tag <tags...>', 'Replace tags')
    .option('-d, --due <date>', 'Set due date (ISO format)')
    .option('-D, --defer <date>', 'Set defer date (ISO format)')
    .option('-f, --flag', 'Flag the task')
    .option('-F, --unflag', 'Unflag the task')
    .option('-c, --complete', 'Mark as completed')
    .option('-C, --incomplete', 'Mark as incomplete')
    .option('-e, --estimate <minutes>', 'Estimated time in minutes', parseInt)
    .action(async (idOrName, options) => {
      await executeOmniFocusCommand(
        'Updating task...',
        (of) => {
          const updates: UpdateTaskOptions = {
            ...(options.name && { name: options.name }),
            ...(options.note !== undefined && { note: options.note }),
            ...(options.project && { project: options.project }),
            ...(options.tag && { tags: options.tag }),
            ...(options.due !== undefined && { due: options.due }),
            ...(options.defer !== undefined && { defer: options.defer }),
            ...(options.flag && { flagged: true }),
            ...(options.unflag && { flagged: false }),
            ...(options.complete && { completed: true }),
            ...(options.incomplete && { completed: false }),
            ...(options.estimate !== undefined && { estimatedMinutes: options.estimate }),
          };

          return of.updateTask(idOrName, updates);
        },
        (task) => outputJson(task),
        'Failed to update task'
      );
    });

  command
    .command('delete <idOrName>')
    .alias('rm')
    .description('Delete a task')
    .action(async (idOrName) => {
      await executeOmniFocusCommand(
        'Deleting task...',
        (of) => of.deleteTask(idOrName),
        () => outputJson({ message: 'Task deleted successfully' }),
        'Failed to delete task'
      );
    });

  command
    .command('view <idOrName>')
    .description('View task details')
    .action(async (idOrName) => {
      await executeOmniFocusCommand(
        'Loading task...',
        (of) => of.getTask(idOrName),
        (task) => outputJson(task),
        'Failed to load task'
      );
    });

  command
    .command('stats')
    .description('Show task statistics')
    .action(async () => {
      await executeOmniFocusCommand(
        'Analyzing tasks...',
        (of) => of.getTaskStats(),
        (stats) => outputJson(stats),
        'Failed to analyze tasks'
      );
    });

  return command;
}
