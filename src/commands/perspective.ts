import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { OmniFocusCliError } from '../lib/errors.js';
import { parsePerspectiveRules } from '../lib/perspective-rules.js';
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

  command
    .command('get-rules <idOrName>')
    .description('Read a custom perspective rule archive as structured JSON')
    .action(
      withErrorHandling(async (idOrName) => {
        outputJson(await new OmniFocus().getPerspectiveRules(idOrName));
      })
    );

  command
    .command('update-rules <idOrName>')
    .description('Replace a custom perspective rule archive from a JSON definition file')
    .requiredOption('--file <path>', 'JSON definition file (use - for stdin)')
    .action(
      withErrorHandling(async (idOrName, options) => {
        const text = await readFile(options.file === '-' ? '/dev/stdin' : options.file, 'utf8');
        let input: unknown;
        try {
          input = JSON.parse(text);
        } catch {
          throw new OmniFocusCliError('Invalid perspective rules: expected a JSON definition', 400);
        }
        const definition = parsePerspectiveRules(input);
        outputJson(await new OmniFocus().updatePerspectiveRules(idOrName, definition));
      })
    );

  return command;
}
