import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';

export function createSearchCommand(): Command {
  const command = new Command('search');
  command.description('Search tasks by name or note');
  command.argument('<query>', 'Search query');

  command.action(async (query) => {
    await executeOmniFocusCommand(
      'Searching...',
      (of) => of.searchTasks(query),
      (tasks) => outputJson(tasks),
      'Search failed'
    );
  });

  return command;
}
