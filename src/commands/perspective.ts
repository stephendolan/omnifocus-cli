import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';

export function createPerspectiveCommand(): Command {
  const command = new Command('perspective');
  command.description('Manage OmniFocus perspectives');

  command
    .command('list')
    .alias('ls')
    .description('List all perspectives')
    .action(async () => {
      await executeOmniFocusCommand(
        'Loading perspectives...',
        (of) => of.listPerspectives(),
        (perspectives) => outputJson(perspectives),
        'Failed to load perspectives'
      );
    });

  command
    .command('view <name>')
    .description('View tasks in a perspective')
    .action(async (name) => {
      await executeOmniFocusCommand(
        `Loading perspective "${name}"...`,
        (of) => of.getPerspectiveTasks(name),
        (tasks) => outputJson(tasks),
        'Failed to load perspective'
      );
    });

  return command;
}
