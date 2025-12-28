import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';

export function createPerspectiveCommand(): Command {
  const command = new Command('perspective');
  command.description('Manage OmniFocus perspectives');

  command
    .command('list')
    .alias('ls')
    .description('List all perspectives')
    .action(
      withErrorHandling(async () => {
        const of = new OmniFocus();
        const perspectives = await of.listPerspectives();
        outputJson(perspectives);
      })
    );

  command
    .command('view <name>')
    .description('View tasks in a perspective')
    .action(
      withErrorHandling(async (name) => {
        const of = new OmniFocus();
        const tasks = await of.getPerspectiveTasks(name);
        outputJson(tasks);
      })
    );

  return command;
}
