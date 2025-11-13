import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';

export function createInboxCommand(): Command {
  const command = new Command('inbox');
  command.description('Manage OmniFocus inbox');

  command
    .command('list')
    .alias('ls')
    .description('List inbox tasks')
    .action(async () => {
      await executeOmniFocusCommand(
        'Loading inbox...',
        (of) => of.listInboxTasks(),
        (tasks) => outputJson(tasks),
        'Failed to load inbox'
      );
    });

  command
    .command('count')
    .description('Get inbox count')
    .action(async () => {
      await executeOmniFocusCommand(
        'Counting inbox items...',
        (of) => of.getInboxCount(),
        (count) => outputJson({ count }),
        'Failed to get inbox count'
      );
    });

  return command;
}
