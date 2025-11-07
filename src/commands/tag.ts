import { Command } from 'commander';
import { displayTagList, displayTagStats, displayTagDetails, displayWithSuccessMessage, displaySuccessMessage } from '../lib/display.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';
import type { UpdateTagOptions } from '../types.js';

export function createTagCommand(): Command {
  const command = new Command('tag');
  command.description('Manage and analyze OmniFocus tags');

  command
    .command('list')
    .alias('ls')
    .description('List tags with usage information')
    .option('-u, --unused-days <days>', 'Show tags unused for N days', parseInt)
    .option('-s, --sort <field>', 'Sort by: name, usage, activity (default: name)', 'name')
    .option('-a, --active-only', 'Only count active (incomplete) tasks')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      await executeOmniFocusCommand(
        'Loading tags...',
        (of) => of.listTags({
          unusedDays: options.unusedDays,
          sortBy: options.sort,
          activeOnly: options.activeOnly,
        }),
        (tags) => displayTagList(tags, options.verbose),
        'Failed to load tags'
      );
    });

  command
    .command('create <name>')
    .description('Create a new tag')
    .option('-p, --parent <name>', 'Create as child of parent tag')
    .option('-s, --status <status>', 'Set status (active, on hold, dropped)')
    .action(async (name, options) => {
      await executeOmniFocusCommand(
        'Creating tag...',
        (of) => of.createTag({
          name,
          parent: options.parent,
          status: options.status,
        }),
        (tag) => displayWithSuccessMessage('Tag created successfully', tag, displayTagDetails),
        'Failed to create tag'
      );
    });

  command
    .command('view <idOrName>')
    .description('View tag details')
    .action(async (idOrName) => {
      await executeOmniFocusCommand(
        'Loading tag...',
        (of) => of.getTag(idOrName),
        (tag) => displayTagDetails(tag),
        'Failed to load tag'
      );
    });

  command
    .command('update <idOrName>')
    .description('Update an existing tag')
    .option('-n, --name <name>', 'Rename tag')
    .option('-s, --status <status>', 'Set status (active, on hold, dropped)')
    .action(async (idOrName, options) => {
      await executeOmniFocusCommand(
        'Updating tag...',
        (of) => {
          const updates: UpdateTagOptions = {
            ...(options.name && { name: options.name }),
            ...(options.status && { status: options.status }),
          };
          return of.updateTag(idOrName, updates);
        },
        (tag) => displayWithSuccessMessage('Tag updated successfully', tag, displayTagDetails),
        'Failed to update tag'
      );
    });

  command
    .command('delete <idOrName>')
    .alias('rm')
    .description('Delete a tag')
    .action(async (idOrName) => {
      await executeOmniFocusCommand(
        'Deleting tag...',
        (of) => of.deleteTag(idOrName),
        () => displaySuccessMessage('Tag deleted successfully'),
        'Failed to delete tag'
      );
    });

  command
    .command('stats')
    .description('Show tag usage statistics')
    .action(async () => {
      await executeOmniFocusCommand(
        'Analyzing tags...',
        (of) => of.getTagStats(),
        (stats) => displayTagStats(stats),
        'Failed to analyze tags'
      );
    });

  return command;
}
