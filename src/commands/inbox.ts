import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';

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

  return command;
}
