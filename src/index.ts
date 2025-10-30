#!/usr/bin/env node

import { Command } from 'commander';
import { createTaskCommand } from './commands/task.js';
import { createProjectCommand } from './commands/project.js';
import { createInboxCommand } from './commands/inbox.js';
import { createSearchCommand } from './commands/search.js';
import { createPerspectiveCommand } from './commands/perspective.js';

const program = new Command();

program
  .name('of')
  .description('A command-line interface for OmniFocus on macOS')
  .version('1.0.0');

program.addCommand(createTaskCommand());
program.addCommand(createProjectCommand());
program.addCommand(createInboxCommand());
program.addCommand(createSearchCommand());
program.addCommand(createPerspectiveCommand());

program.parse();
