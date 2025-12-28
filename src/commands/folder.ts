import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';
import type { FolderFilters } from '../types.js';

export function createFolderCommand(): Command {
  const command = new Command('folder');
  command.description('View OmniFocus folder hierarchy');

  command
    .command('list')
    .alias('ls')
    .description('List top-level folders with nested children')
    .option('-d, --dropped', 'Include dropped folders')
    .action(
      withErrorHandling(async (options) => {
        const of = new OmniFocus();
        const folders = await of.listFolders({ includeDropped: options.dropped });
        outputJson(folders);
      })
    );

  command
    .command('view <idOrName>')
    .description('View folder details and children')
    .option('-d, --dropped', 'Include dropped child folders')
    .action(
      withErrorHandling(async (idOrName, options) => {
        const of = new OmniFocus();
        const filters: FolderFilters = { includeDropped: options.dropped };
        const folder = await of.getFolder(idOrName, filters);
        outputJson(folder);
      })
    );

  return command;
}
