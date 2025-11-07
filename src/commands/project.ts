import { Command } from 'commander';
import { displayProjectList, displayProjectDetails, displayWithSuccessMessage, displaySuccessMessage, displayProjectStats } from '../lib/display.js';
import { executeOmniFocusCommand } from '../lib/command-utils.js';
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
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      await executeOmniFocusCommand(
        'Loading projects...',
        (of) => {
          const filters: ProjectFilters = {
            includeDropped: options.dropped,
            ...(options.folder && { folder: options.folder }),
            ...(options.status && { status: options.status }),
          };

          return of.listProjects(filters);
        },
        (projects) => displayProjectList(projects, options.verbose),
        'Failed to load projects'
      );
    });

  command
    .command('create <name>')
    .description('Create a new project')
    .option('-f, --folder <name>', 'Assign to folder')
    .option('-n, --note <text>', 'Add note')
    .option('-t, --tag <tags...>', 'Add tags')
    .option('-s, --sequential', 'Make it a sequential project')
    .option('--status <status>', 'Set status (active, on hold, dropped)')
    .action(async (name, options) => {
      await executeOmniFocusCommand(
        'Creating project...',
        (of) => of.createProject({
          name,
          note: options.note,
          folder: options.folder,
          tags: options.tag,
          sequential: options.sequential,
          status: options.status,
        }),
        (project) => displayWithSuccessMessage('Project created successfully', project, displayProjectDetails),
        'Failed to create project'
      );
    });

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
    .action(async (idOrName, options) => {
      await executeOmniFocusCommand(
        'Updating project...',
        (of) => {
          const updates: UpdateProjectOptions = {
            ...(options.name && { name: options.name }),
            ...(options.note !== undefined && { note: options.note }),
            ...(options.folder && { folder: options.folder }),
            ...(options.tag && { tags: options.tag }),
            ...(options.sequential && { sequential: true }),
            ...(options.parallel && { sequential: false }),
            ...(options.status && { status: options.status }),
          };

          return of.updateProject(idOrName, updates);
        },
        (project) => displayWithSuccessMessage('Project updated successfully', project, displayProjectDetails),
        'Failed to update project'
      );
    });

  command
    .command('delete <idOrName>')
    .alias('rm')
    .description('Delete a project')
    .action(async (idOrName) => {
      await executeOmniFocusCommand(
        'Deleting project...',
        (of) => of.deleteProject(idOrName),
        () => displaySuccessMessage('Project deleted successfully'),
        'Failed to delete project'
      );
    });

  command
    .command('view <idOrName>')
    .description('View project details')
    .action(async (idOrName) => {
      await executeOmniFocusCommand(
        'Loading project...',
        (of) => of.getProject(idOrName),
        (project) => displayProjectDetails(project),
        'Failed to load project'
      );
    });

  command
    .command('stats')
    .description('Show project statistics')
    .action(async () => {
      await executeOmniFocusCommand(
        'Analyzing projects...',
        (of) => of.getProjectStats(),
        (stats) => displayProjectStats(stats),
        'Failed to analyze projects'
      );
    });

  return command;
}
