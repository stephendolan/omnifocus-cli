import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';

export function createSearchCommand(): Command {
  const command = new Command('search');
  command.description('Search tasks by name or note');
  command.argument('<query>', 'Search query');

  command.action(
    withErrorHandling(async (query) => {
      const of = new OmniFocus();
      const tasks = await of.searchTasks(query);
      outputJson(tasks);
    })
  );

  return command;
}
