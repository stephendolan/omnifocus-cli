import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';
import type { FolderFilters } from '../types.js';

export function createFolderCommand(): Command {
  const command = new Command('folder');
  command.description('View OmniFocus folder hierarchy');

  command
    .command('list')
    .alias('ls')
    .description('List top-level folders with nested children')
    .option('-d, --dropped', 'Include dropped folders')
    .action(async (options) => {
      await executeOmniFocusCommand(
        'Loading folders...',
        (of) => of.listFolders({ includeDropped: options.dropped }),
        (folders) => outputJson(folders),
        'Failed to load folders'
      );
    });

  command
    .command('view <idOrName>')
    .description('View folder details and children')
    .option('-d, --dropped', 'Include dropped child folders')
    .action(async (idOrName, options) => {
      const filters: FolderFilters = { includeDropped: options.dropped };
      await executeOmniFocusCommand(
        'Loading folder...',
        (of) => of.getFolder(idOrName, filters),
        (folder) => outputJson(folder),
        'Failed to load folder'
      );
    });

  return command;
}
