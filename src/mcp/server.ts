import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OmniFocus } from '../lib/omnifocus.js';
import packageJson from '../../package.json' with { type: 'json' };
import { canUseTool, type CapabilityMode } from './capabilities.js';

const toolRegistry = [
  { name: 'list_tasks', description: 'List tasks with optional filtering' },
  { name: 'get_task', description: 'Get a specific task by ID or name' },
  { name: 'create_task', description: 'Create a new task' },
  { name: 'update_task', description: 'Update an existing task' },
  { name: 'delete_task', description: 'Delete a task' },
  { name: 'search_tasks', description: 'Search tasks by name or note content' },
  { name: 'get_task_stats', description: 'Get task statistics' },
  { name: 'list_inbox', description: 'List remaining inbox tasks, including subtasks' },
  { name: 'get_inbox_count', description: 'Get the number of remaining inbox tasks' },
  { name: 'list_projects', description: 'List projects with optional filtering' },
  { name: 'get_project', description: 'Get a specific project by ID or name' },
  { name: 'create_project', description: 'Create a new project' },
  { name: 'update_project', description: 'Update an existing project' },
  { name: 'delete_project', description: 'Delete a project' },
  { name: 'get_project_stats', description: 'Get project statistics' },
  { name: 'list_perspectives', description: 'List all available perspectives' },
  { name: 'get_perspective_tasks', description: 'Get tasks from a specific perspective' },
  { name: 'list_tags', description: 'List all tags with optional filtering and sorting' },
  { name: 'get_tag', description: 'Get a specific tag by ID or name' },
  { name: 'create_tag', description: 'Create a new tag' },
  { name: 'update_tag', description: 'Update an existing tag' },
  { name: 'delete_tag', description: 'Delete a tag' },
  { name: 'get_tag_stats', description: 'Get tag statistics' },
  { name: 'list_folders', description: 'List all folders' },
  { name: 'get_folder', description: 'Get a specific folder by ID or name' },
];

export interface McpServerOptions {
  mode?: CapabilityMode;
  omniFocus?: OmniFocus;
  execute?: <T>(operation: () => Promise<T>) => Promise<T>;
}

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function createMcpServer(options: McpServerOptions = {}): McpServer {
  const mode = options.mode ?? 'full';
  const of = options.omniFocus ?? new OmniFocus();
  const execute = options.execute ?? (<T>(operation: () => Promise<T>) => operation());
  const server = new McpServer({
    name: 'omnifocus',
    version: packageJson.version,
  });

  if (canUseTool('list_tasks', mode)) {
    server.tool(
      'list_tasks',
      'List tasks with optional filtering',
      {
        includeCompleted: z.boolean().optional().describe('Include completed tasks'),
        includeDropped: z.boolean().optional().describe('Include dropped tasks'),
        flagged: z.boolean().optional().describe('Only show flagged tasks'),
        project: z.string().optional().describe('Filter by project name'),
        tag: z.string().optional().describe('Filter by tag name'),
      },
      async (filters) => jsonResponse(await execute(() => of.listTasks(filters)))
    );
  }

  if (canUseTool('get_task', mode)) {
    server.tool(
      'get_task',
      'Get a specific task by ID or name',
      { idOrName: z.string().describe('Task ID or name') },
      async ({ idOrName }) => jsonResponse(await execute(() => of.getTask(idOrName)))
    );
  }

  if (canUseTool('create_task', mode)) {
    server.tool(
      'create_task',
      'Create a new task',
      {
        name: z.string().describe('Task name'),
        note: z.string().optional().describe('Task note'),
        project: z.string().optional().describe('Project to add task to'),
        tags: z.array(z.string()).optional().describe('Tags to assign'),
        defer: z.string().optional().describe('Defer date (ISO 8601)'),
        due: z.string().optional().describe('Due date (ISO 8601)'),
        planned: z.string().optional().describe('Planned date (ISO 8601)'),
        flagged: z.boolean().optional().describe('Flag the task'),
        estimatedMinutes: z.number().optional().describe('Estimated duration in minutes'),
      },
      async (options) => jsonResponse(await execute(() => of.createTask(options)))
    );
  }

  if (canUseTool('update_task', mode)) {
    server.tool(
      'update_task',
      'Update an existing task',
      {
        idOrName: z.string().describe('Task ID or name'),
        name: z.string().optional().describe('New task name'),
        note: z.string().optional().describe('New task note'),
        project: z.string().optional().describe('Move to project'),
        tags: z.array(z.string()).optional().describe('Replace tags'),
        defer: z.string().optional().describe('New defer date (ISO 8601)'),
        due: z.string().optional().describe('New due date (ISO 8601)'),
        planned: z.string().optional().describe('New planned date (ISO 8601)'),
        flagged: z.boolean().optional().describe('Flag/unflag the task'),
        estimatedMinutes: z.number().optional().describe('New estimated duration'),
        completed: z.boolean().optional().describe('Mark complete/incomplete'),
        dropped: z.boolean().optional().describe('Mark dropped/undropped'),
      },
      async ({ idOrName, ...options }) =>
        jsonResponse(await execute(() => of.updateTask(idOrName, options)))
    );
  }

  if (canUseTool('delete_task', mode)) {
    server.tool(
      'delete_task',
      'Delete a task',
      { idOrName: z.string().describe('Task ID or name') },
      async ({ idOrName }) => {
        await execute(() => of.deleteTask(idOrName));
        return jsonResponse({ deleted: true });
      }
    );
  }

  if (canUseTool('search_tasks', mode)) {
    server.tool(
      'search_tasks',
      'Search tasks by name or note content',
      { query: z.string().describe('Search query') },
      async ({ query }) => jsonResponse(await execute(() => of.searchTasks(query)))
    );
  }

  if (canUseTool('get_task_stats', mode)) {
    server.tool('get_task_stats', 'Get task statistics', {}, async () =>
      jsonResponse(await execute(() => of.getTaskStats()))
    );
  }

  if (canUseTool('list_inbox', mode)) {
    server.tool('list_inbox', 'List remaining inbox tasks, including subtasks', {}, async () =>
      jsonResponse(await execute(() => of.listInboxTasks()))
    );
  }

  if (canUseTool('get_inbox_count', mode)) {
    server.tool('get_inbox_count', 'Get the number of remaining inbox tasks', {}, async () =>
      jsonResponse({ count: await execute(() => of.getInboxCount()) })
    );
  }

  if (canUseTool('list_projects', mode)) {
    server.tool(
      'list_projects',
      'List projects with optional filtering',
      {
        includeDropped: z.boolean().optional().describe('Include dropped projects'),
        status: z.enum(['active', 'on hold', 'dropped']).optional().describe('Filter by status'),
        folder: z.string().optional().describe('Filter by folder name'),
      },
      async (filters) => jsonResponse(await execute(() => of.listProjects(filters)))
    );
  }

  if (canUseTool('get_project', mode)) {
    server.tool(
      'get_project',
      'Get a specific project by ID or name',
      { idOrName: z.string().describe('Project ID or name') },
      async ({ idOrName }) => jsonResponse(await execute(() => of.getProject(idOrName)))
    );
  }

  if (canUseTool('create_project', mode)) {
    server.tool(
      'create_project',
      'Create a new project',
      {
        name: z.string().describe('Project name'),
        note: z.string().optional().describe('Project note'),
        folder: z.string().optional().describe('Folder to create project in'),
        sequential: z
          .boolean()
          .optional()
          .describe('Sequential project (tasks must be done in order)'),
        tags: z.array(z.string()).optional().describe('Tags to assign'),
        status: z.enum(['active', 'on hold', 'dropped']).optional().describe('Initial status'),
      },
      async (options) => jsonResponse(await execute(() => of.createProject(options)))
    );
  }

  if (canUseTool('update_project', mode)) {
    server.tool(
      'update_project',
      'Update an existing project',
      {
        idOrName: z.string().describe('Project ID or name'),
        name: z.string().optional().describe('New project name'),
        note: z.string().optional().describe('New project note'),
        folder: z.string().optional().describe('Move to folder'),
        sequential: z.boolean().optional().describe('Set sequential/parallel'),
        tags: z.array(z.string()).optional().describe('Replace tags'),
        status: z.enum(['active', 'on hold', 'dropped']).optional().describe('New status'),
      },
      async ({ idOrName, ...options }) =>
        jsonResponse(await execute(() => of.updateProject(idOrName, options)))
    );
  }

  if (canUseTool('delete_project', mode)) {
    server.tool(
      'delete_project',
      'Delete a project',
      { idOrName: z.string().describe('Project ID or name') },
      async ({ idOrName }) => {
        await execute(() => of.deleteProject(idOrName));
        return jsonResponse({ deleted: true });
      }
    );
  }

  if (canUseTool('get_project_stats', mode)) {
    server.tool('get_project_stats', 'Get project statistics', {}, async () =>
      jsonResponse(await execute(() => of.getProjectStats()))
    );
  }

  if (canUseTool('list_perspectives', mode)) {
    server.tool('list_perspectives', 'List all available perspectives', {}, async () =>
      jsonResponse(await execute(() => of.listPerspectives()))
    );
  }

  if (canUseTool('get_perspective_tasks', mode)) {
    server.tool(
      'get_perspective_tasks',
      'Get tasks from a specific perspective',
      {
        name: z.string().describe('Perspective name (e.g., Inbox, Flagged, or custom perspective)'),
      },
      async ({ name }) => jsonResponse(await execute(() => of.getPerspectiveTasks(name)))
    );
  }

  if (canUseTool('list_tags', mode)) {
    server.tool(
      'list_tags',
      'List all tags with optional filtering and sorting',
      {
        unusedDays: z.number().optional().describe('Only show tags unused for this many days'),
        sortBy: z.enum(['name', 'usage', 'activity']).optional().describe('Sort order'),
        activeOnly: z.boolean().optional().describe('Only count active tasks'),
      },
      async (options) => jsonResponse(await execute(() => of.listTags(options)))
    );
  }

  if (canUseTool('get_tag', mode)) {
    server.tool(
      'get_tag',
      'Get a specific tag by ID or name',
      { idOrName: z.string().describe('Tag ID, name, or path (e.g., "Parent/Child")') },
      async ({ idOrName }) => jsonResponse(await execute(() => of.getTag(idOrName)))
    );
  }

  if (canUseTool('create_tag', mode)) {
    server.tool(
      'create_tag',
      'Create a new tag',
      {
        name: z.string().describe('Tag name'),
        parent: z.string().optional().describe('Parent tag name or path'),
        status: z.enum(['active', 'on hold', 'dropped']).optional().describe('Initial status'),
      },
      async (options) => jsonResponse(await execute(() => of.createTag(options)))
    );
  }

  if (canUseTool('update_tag', mode)) {
    server.tool(
      'update_tag',
      'Update an existing tag',
      {
        idOrName: z.string().describe('Tag ID, name, or path'),
        name: z.string().optional().describe('New tag name'),
        status: z.enum(['active', 'on hold', 'dropped']).optional().describe('New status'),
      },
      async ({ idOrName, ...options }) =>
        jsonResponse(await execute(() => of.updateTag(idOrName, options)))
    );
  }

  if (canUseTool('delete_tag', mode)) {
    server.tool(
      'delete_tag',
      'Delete a tag',
      { idOrName: z.string().describe('Tag ID, name, or path') },
      async ({ idOrName }) => {
        await execute(() => of.deleteTag(idOrName));
        return jsonResponse({ deleted: true });
      }
    );
  }

  if (canUseTool('get_tag_stats', mode)) {
    server.tool('get_tag_stats', 'Get tag statistics', {}, async () =>
      jsonResponse(await execute(() => of.getTagStats()))
    );
  }

  if (canUseTool('list_folders', mode)) {
    server.tool(
      'list_folders',
      'List all folders',
      { includeDropped: z.boolean().optional().describe('Include dropped folders') },
      async (filters) => jsonResponse(await execute(() => of.listFolders(filters)))
    );
  }

  if (canUseTool('get_folder', mode)) {
    server.tool(
      'get_folder',
      'Get a specific folder by ID or name',
      {
        idOrName: z.string().describe('Folder ID or name'),
        includeDropped: z.boolean().optional().describe('Include dropped children'),
      },
      async ({ idOrName, includeDropped }) =>
        jsonResponse(await execute(() => of.getFolder(idOrName, { includeDropped })))
    );
  }

  if (canUseTool('search_tools', mode)) {
    server.tool(
      'search_tools',
      'Search for available tools by name or description using regex. Returns matching tool names.',
      {
        query: z
          .string()
          .describe(
            'Regex pattern to match against tool names and descriptions (case-insensitive)'
          ),
      },
      async ({ query }) => {
        try {
          const pattern = new RegExp(query, 'i');
          const matches = toolRegistry.filter(
            (t) => canUseTool(t.name, mode) && (pattern.test(t.name) || pattern.test(t.description))
          );
          return jsonResponse({ tools: matches });
        } catch {
          return jsonResponse({ error: 'Invalid regex pattern' });
        }
      }
    );
  }

  return server;
}

export async function runMcpServer(options: McpServerOptions = {}) {
  await createMcpServer(options).connect(new StdioServerTransport());
}
