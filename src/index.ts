#!/usr/bin/env node

import { Command } from 'commander';
import { setOutputOptions } from './lib/output.js';
import { createTaskCommand } from './commands/task.js';
import { createProjectCommand } from './commands/project.js';
import { createInboxCommand } from './commands/inbox.js';
import { createSearchCommand } from './commands/search.js';
import { createPerspectiveCommand } from './commands/perspective.js';
import { createTagCommand } from './commands/tag.js';
import { createFolderCommand } from './commands/folder.js';

const program = new Command();

program
  .name('of')
  .description('A command-line interface for OmniFocus on macOS')
  .version('1.0.0')
  .option('-c, --compact', 'Minified JSON output (single line)')
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

program.parseAsync().catch(() => {
  process.exit(1);
});
