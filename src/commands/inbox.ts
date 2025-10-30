import { Command } from 'commander';
import chalk from 'chalk';
import { displayTaskList, pluralize } from '../lib/display.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';

export function createInboxCommand(): Command {
  const command = new Command('inbox');
  command.description('Manage OmniFocus inbox');

  command
    .command('list')
    .alias('ls')
    .description('List inbox tasks')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      await executeOmniFocusCommand(
        'Loading inbox...',
        (of) => of.listInboxTasks(),
        (tasks) => displayTaskList(tasks, options.verbose),
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
        (count) => {
          if (count === 0) {
            console.log(chalk.green('✓ Inbox is empty'));
          } else {
            console.log(chalk.yellow(`📥 ${pluralize(count, 'item')} in inbox`));
          }
        },
        'Failed to get inbox count'
      );
    });

  return command;
}
