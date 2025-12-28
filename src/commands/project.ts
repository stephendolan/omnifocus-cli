import { Command } from 'commander';
import { outputJson } from '../lib/output.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { OmniFocus } from '../lib/omnifocus.js';
import type { ProjectFilters, UpdateProjectOptions } from '../types.js';

export function createProjectCommand(): Command {
  const command = new Command('project');
  command.description('Manage OmniFocus projects');

  command
    .command('list')
    .alias('ls')
    .description('List projects')
    .option('-f, --folder <name>', 'Filter by folder')
    .option('-s, --status <status>', 'Filter by status (active, on hold, dropped)')
    .option('-d, --dropped', 'Include dropped projects')
    .action(
      withErrorHandling(async (options) => {
        const of = new OmniFocus();
        const filters: ProjectFilters = {
          includeDropped: options.dropped,
          ...(options.folder && { folder: options.folder }),
          ...(options.status && { status: options.status }),
        };
        const projects = await of.listProjects(filters);
        outputJson(projects);
      })
    );

  command
    .command('create <name>')
    .description('Create a new project')
    .option('-f, --folder <name>', 'Assign to folder')
    .option('--note <text>', 'Add note')
    .option('-t, --tag <tags...>', 'Add tags')
    .option('-s, --sequential', 'Make it a sequential project')
    .option('--status <status>', 'Set status (active, on hold, dropped)')
    .action(
      withErrorHandling(async (name, options) => {
        const of = new OmniFocus();
        const project = await of.createProject({
          name,
          note: options.note,
          folder: options.folder,
          tags: options.tag,
          sequential: options.sequential,
          status: options.status,
        });
        outputJson(project);
      })
    );

  command
    .command('update <idOrName>')
    .description('Update an existing project')
    .option('-n, --name <name>', 'Rename project')
    .option('--note <text>', 'New note')
    .option('-f, --folder <name>', 'Move to folder')
    .option('-t, --tag <tags...>', 'Replace tags')
    .option('-s, --sequential', 'Make it sequential')
    .option('-p, --parallel', 'Make it parallel')
    .option('--status <status>', 'Set status (active, on hold, dropped)')
    .action(
      withErrorHandling(async (idOrName, options) => {
        const of = new OmniFocus();
        const updates: UpdateProjectOptions = {
          ...(options.name && { name: options.name }),
          ...(options.note !== undefined && { note: options.note }),
          ...(options.folder && { folder: options.folder }),
          ...(options.tag && { tags: options.tag }),
          ...(options.sequential && { sequential: true }),
          ...(options.parallel && { sequential: false }),
          ...(options.status && { status: options.status }),
        };
        const project = await of.updateProject(idOrName, updates);
        outputJson(project);
      })
    );

  command
    .command('delete <idOrName>')
    .alias('rm')
    .description('Delete a project')
    .action(
      withErrorHandling(async (idOrName) => {
        const of = new OmniFocus();
        await of.deleteProject(idOrName);
        outputJson({ message: 'Project deleted successfully' });
      })
    );

  command
    .command('view <idOrName>')
    .description('View project details')
    .action(
      withErrorHandling(async (idOrName) => {
        const of = new OmniFocus();
        const project = await of.getProject(idOrName);
        outputJson(project);
      })
    );

  command
    .command('stats')
    .description('Show project statistics')
    .action(
      withErrorHandling(async () => {
        const of = new OmniFocus();
        const stats = await of.getProjectStats();
        outputJson(stats);
      })
    );

  return command;
}
