import { Command } from 'commander';
import { displayTaskList, displayPerspectiveList } from '../lib/display.js';
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
        (perspectives) => displayPerspectiveList(perspectives),
        'Failed to load perspectives'
      );
    });

  command
    .command('view <name>')
    .description('View tasks in a perspective')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (name, options) => {
      await executeOmniFocusCommand(
        `Loading perspective "${name}"...`,
        (of) => of.getPerspectiveTasks(name),
        (tasks) => displayTaskList(tasks, options.verbose),
        'Failed to load perspective'
      );
    });

  return command;
}
