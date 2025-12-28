import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';
import { parseDateTime } from '../lib/dates.js';

export function createInboxCommand(): Command {
  const command = new Command('inbox');
  command.description('Manage OmniFocus inbox');

  command
    .command('list')
    .alias('ls')
    .description('List inbox tasks')
    .action(
      withErrorHandling(async () => {
        const of = new OmniFocus();
        const tasks = await of.listInboxTasks();
        outputJson(tasks);
      })
    );

  command
    .command('count')
    .description('Get inbox count')
    .action(
      withErrorHandling(async () => {
        const of = new OmniFocus();
        const count = await of.getInboxCount();
        outputJson({ count });
      })
    );

  command
    .command('add <name>')
    .description('Add a task to inbox')
    .option('--note <text>', 'Add note')
    .option('-t, --tag <tags...>', 'Add tags')
    .option('-d, --due <date>', 'Set due date')
    .option('-D, --defer <date>', 'Set defer date')
    .option('-f, --flagged', 'Flag the task')
    .option('-e, --estimate <minutes>', 'Estimated time in minutes', parseInt)
    .action(
      withErrorHandling(async (name, options) => {
        const of = new OmniFocus();
        const task = await of.createTask({
          name,
          note: options.note,
          tags: options.tag,
          due: options.due ? parseDateTime(options.due) : undefined,
          defer: options.defer ? parseDateTime(options.defer) : undefined,
          flagged: options.flagged,
          estimatedMinutes: options.estimate,
        });
        outputJson(task);
      })
    );

  return command;
}
