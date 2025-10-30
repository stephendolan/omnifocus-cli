import { Command } from 'commander';
import { displayTaskList } from '../lib/display.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';

export function createSearchCommand(): Command {
  const command = new Command('search');
  command.description('Search tasks by name or note');
  command.argument('<query>', 'Search query');
  command.option('-v, --verbose', 'Show detailed information');

  command.action(async (query, options) => {
    await executeOmniFocusCommand(
      'Searching...',
      (of) => of.searchTasks(query),
      (tasks) => displayTaskList(tasks, options.verbose),
      'Search failed'
    );
  });

  return command;
}
