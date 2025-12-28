import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';
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
    .action(
      withErrorHandling(async (options) => {
        const of = new OmniFocus();
        const tags = await of.listTags({
          unusedDays: options.unusedDays,
          sortBy: options.sort,
          activeOnly: options.activeOnly,
        });
        outputJson(tags);
      })
    );

  command
    .command('create <name>')
    .description('Create a new tag')
    .option('-p, --parent <name>', 'Create as child of parent tag')
    .option('-s, --status <status>', 'Set status (active, on hold, dropped)')
    .action(
      withErrorHandling(async (name, options) => {
        const of = new OmniFocus();
        const tag = await of.createTag({
          name,
          parent: options.parent,
          status: options.status,
        });
        outputJson(tag);
      })
    );

  command
    .command('view <idOrName>')
    .description('View tag details')
    .action(
      withErrorHandling(async (idOrName) => {
        const of = new OmniFocus();
        const tag = await of.getTag(idOrName);
        outputJson(tag);
      })
    );

  command
    .command('update <idOrName>')
    .description('Update an existing tag')
    .option('-n, --name <name>', 'Rename tag')
    .option('-s, --status <status>', 'Set status (active, on hold, dropped)')
    .action(
      withErrorHandling(async (idOrName, options) => {
        const of = new OmniFocus();
        const updates: UpdateTagOptions = {
          ...(options.name && { name: options.name }),
          ...(options.status && { status: options.status }),
        };
        const tag = await of.updateTag(idOrName, updates);
        outputJson(tag);
      })
    );

  command
    .command('delete <idOrName>')
    .alias('rm')
    .description('Delete a tag')
    .action(
      withErrorHandling(async (idOrName) => {
        const of = new OmniFocus();
        await of.deleteTag(idOrName);
        outputJson({ message: 'Tag deleted successfully' });
      })
    );

  command
    .command('stats')
    .description('Show tag usage statistics')
    .action(
      withErrorHandling(async () => {
        const of = new OmniFocus();
        const stats = await of.getTagStats();
        outputJson(stats);
      })
    );

  return command;
}
