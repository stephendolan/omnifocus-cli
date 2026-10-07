#!/usr/bin/env node

import { Command, CommanderError } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { createTaskCommand } from './commands/task.js';
import { createProjectCommand } from './commands/project.js';
import { createInboxCommand } from './commands/inbox.js';
import { createSearchCommand } from './commands/search.js';
import { createPerspectiveCommand } from './commands/perspective.js';
import { createTagCommand } from './commands/tag.js';
import { createFolderCommand } from './commands/folder.js';
import { createMcpCommand } from './commands/mcp.js';

const program = new Command();

program
  .name('of')
  .description('A command-line interface for OmniFocus on macOS')
  .version(__VERSION__)
  .option('-c, --compact', 'Minified JSON output (single line)')
  .exitOverride()
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    setOutputOptions({
      compact: options.compact,
    });
  });

program.addCommand(createTaskCommand());
program.addCommand(createProjectCommand());
program.addCommand(createInboxCommand());
program.addCommand(createSearchCommand());
program.addCommand(createPerspectiveCommand());
program.addCommand(createTagCommand());
program.addCommand(createFolderCommand());
program.addCommand(createMcpCommand());

program.parseAsync().catch((err) => {
  // Set exitCode instead of calling process.exit() so any queued stdout
  // writes finish before the process terminates. See errors.ts for details.
  // CommanderError covers --help, --version, and parse errors; commander has
  // already written the relevant output, so just propagate the exit code.
  process.exitCode = err instanceof CommanderError ? err.exitCode : 1;
});
