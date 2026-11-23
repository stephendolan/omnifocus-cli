import {
  taskCreate,
  taskUpdate,
  projectCreate,
  projectMutation,
  tagCreate,
  tagUpdate,
  projectStatus,
} from '../lib/mutations.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OmniFocus } from '../lib/omnifocus.js';
import { AutomationPermissionError } from '../lib/consent.js';
import { errorResponse } from '../lib/errors.js';
import packageJson from '../../package.json' with { type: 'json' };
import { canUseTool, type CapabilityMode } from './capabilities.js';
import { loadMcpIcons } from './icons.js';
import { perspectiveRulesSchema } from '../lib/perspective-rules.js';
import type { Icon } from '@modelcontextprotocol/sdk/types.js';

const toolRegistry = [
  { name: 'list_tasks', description: 'List tasks with optional filtering' },
  { name: 'get_task', description: 'Get a specific task by ID or name' },
  { name: 'create_task', description: 'Create a new task' },
  {
    name: 'update_task',
    description:
      'Update task fields, project placement, or order before/after an exact sibling task ID',
  },
  { name: 'delete_task', description: 'Delete a task' },
  { name: 'search_tasks', description: 'Search tasks by name or note content' },
  { name: 'get_task_stats', description: 'Get task statistics' },
  { name: 'list_inbox', description: 'List remaining inbox tasks, including subtasks' },
  { name: 'get_inbox_count', description: 'Get the number of remaining inbox tasks' },
  { name: 'list_projects', description: 'List projects with optional filtering' },
  { name: 'get_project', description: 'Get a specific project by ID or name' },
  {
    name: 'create_project',
    description: 'Create a project with folder and parallel, sequential, or single-action type',
  },
  {
    name: 'update_project',
    description:
      'Update project fields, folder placement, completion, or project type; reject unsupported arguments',
  },
  { name: 'delete_project', description: 'Delete a project' },
  { name: 'get_project_stats', description: 'Get project statistics' },
  { name: 'list_perspectives', description: 'List all available perspectives' },
  {
    name: 'get_perspective_rules',
    description: 'Read a custom perspective rule archive as structured JSON',
  },
  {
    name: 'update_perspective_rules',
    description: 'Replace a custom perspective rule archive with a complete JSON definition',
  },
  { name: 'get_perspective_tasks', description: 'Get tasks from a specific perspective' },
  { name: 'list_tags', description: 'List all tags with optional filtering and sorting' },
  { name: 'get_tag', description: 'Get a specific tag by ID or name' },
  { name: 'create_tag', description: 'Create a new tag' },
  {
    name: 'update_tag',
    description: 'Update tag fields or parent by ID, unique name, or path; null moves to root',
  },
  { name: 'delete_tag', description: 'Delete a tag' },
  { name: 'get_tag_stats', description: 'Get tag statistics' },
  { name: 'list_folders', description: 'List all folders' },
  { name: 'delete_folder', description: 'Delete an empty folder' },
  { name: 'get_folder', description: 'Get a specific folder by ID or name' },
  {
    name: 'create_folder',
    description: 'Create a top-level folder, or return an existing folder with the same name',
  },
];

export interface McpServerOptions {
  mode?: CapabilityMode;
  icons?: Icon[];
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
  async function respond<T>(operation: () => Promise<T>) {
    try {
      return jsonResponse(await execute(operation));
    } catch (error) {
      if (!(error instanceof AutomationPermissionError)) throw error;
      return { ...jsonResponse(errorResponse(error)), isError: true };
    }
  }
  const server = new McpServer({
    name: 'omnifocus',
    version: packageJson.version,
    icons: options.icons ?? loadMcpIcons(),
  });

  if (canUseTool('list_tasks', mode)) {
    server.registerTool(
      'list_tasks',
      {
        description: 'List tasks with optional filtering',
        inputSchema: z.strictObject({
          includeCompleted: z.boolean().optional().describe('Include completed tasks'),
          includeDropped: z.boolean().optional().describe('Include dropped tasks'),
          flagged: z.boolean().optional().describe('Only show flagged tasks'),
          project: z.string().optional().describe('Filter by project name'),
          tag: z.string().optional().describe('Filter by tag name'),
        }),
      },
      async (filters) => respond(() => of.listTasks(filters))
    );
  }

  if (canUseTool('get_task', mode)) {
    server.registerTool(
      'get_task',
      {
        description: 'Get a specific task by ID or name',
        inputSchema: z.strictObject({ idOrName: z.string().describe('Task ID or name') }),
      },
      async ({ idOrName }) => respond(() => of.getTask(idOrName))
    );
  }

  if (canUseTool('create_task', mode)) {
    server.registerTool(
      'create_task',
      { description: 'Create a new task', inputSchema: taskCreate },
      async (options) => respond(() => of.createTask(options))
    );
  }

  if (canUseTool('update_task', mode)) {
    server.registerTool(
      'update_task',
      {
        description:
          'Update task fields, project placement, or order before/after an exact sibling task ID',
        inputSchema: taskUpdate.safeExtend({ idOrName: z.string() }),
      },
      async ({ idOrName, ...options }) => respond(() => of.updateTask(idOrName, options))
    );
  }

  if (canUseTool('delete_task', mode)) {
    server.registerTool(
      'delete_task',
      {
        description: 'Delete a task',
        inputSchema: z.strictObject({ idOrName: z.string().describe('Task ID or name') }),
      },
      async ({ idOrName }) => {
        return respond(async () => {
          await of.deleteTask(idOrName);
          return { deleted: true };
        });
      }
    );
  }

  if (canUseTool('search_tasks', mode)) {
    server.registerTool(
      'search_tasks',
      {
        description: 'Search tasks by name or note content',
        inputSchema: z.strictObject({ query: z.string().describe('Search query') }),
      },
      async ({ query }) => respond(() => of.searchTasks(query))
    );
  }

  if (canUseTool('get_task_stats', mode)) {
    server.registerTool(
      'get_task_stats',
      { description: 'Get task statistics', inputSchema: z.strictObject({}) },
      async () => respond(() => of.getTaskStats())
    );
  }

  if (canUseTool('list_inbox', mode)) {
    server.registerTool(
      'list_inbox',
      {
        description: 'List remaining inbox tasks, including subtasks',
        inputSchema: z.strictObject({}),
      },
      async () => respond(() => of.listInboxTasks())
    );
  }

  if (canUseTool('get_inbox_count', mode)) {
    server.registerTool(
      'get_inbox_count',
      { description: 'Get the number of remaining inbox tasks', inputSchema: z.strictObject({}) },
      async () => respond(async () => ({ count: await of.getInboxCount() }))
    );
  }

  if (canUseTool('list_projects', mode)) {
    server.registerTool(
      'list_projects',
      {
        description: 'List projects with optional filtering',
        inputSchema: z.strictObject({
          includeDropped: z.boolean().optional().describe('Include dropped projects'),
          status: projectStatus.optional().describe('Filter by status'),
          folder: z.string().optional().describe('Filter by folder name'),
        }),
      },
      async (filters) => respond(() => of.listProjects(filters))
    );
  }

  if (canUseTool('get_project', mode)) {
    server.registerTool(
      'get_project',
      {
        description: 'Get a specific project by ID or name',
        inputSchema: z.strictObject({ idOrName: z.string().describe('Project ID or name') }),
      },
      async ({ idOrName }) => respond(() => of.getProject(idOrName))
    );
  }

  if (canUseTool('create_project', mode)) {
    server.registerTool(
      'create_project',
      {
        description: 'Create a project with folder and parallel, sequential, or single-action type',
        inputSchema: projectCreate,
      },
      async (options) => respond(() => of.createProject(options))
    );
  }

  if (canUseTool('update_project', mode)) {
    server.registerTool(
      'update_project',
      {
        description:
          'Update project fields, folder placement, completion, or project type; reject unsupported arguments',
        inputSchema: projectMutation.safeExtend({ idOrName: z.string() }),
      },
      async ({ idOrName, ...options }) => respond(() => of.updateProject(idOrName, options))
    );
  }

  if (canUseTool('delete_project', mode)) {
    server.registerTool(
      'delete_project',
      {
        description: 'Delete a project',
        inputSchema: z.strictObject({ idOrName: z.string().describe('Project ID or name') }),
      },
      async ({ idOrName }) => {
        return respond(async () => {
          await of.deleteProject(idOrName);
          return { deleted: true };
        });
      }
    );
  }

  if (canUseTool('get_project_stats', mode)) {
    server.registerTool(
      'get_project_stats',
      { description: 'Get project statistics', inputSchema: z.strictObject({}) },
      async () => respond(() => of.getProjectStats())
    );
  }

  if (canUseTool('list_perspectives', mode)) {
    server.registerTool(
      'list_perspectives',
      { description: 'List all available perspectives', inputSchema: z.strictObject({}) },
      async () => respond(() => of.listPerspectives())
    );
  }

  if (canUseTool('get_perspective_rules', mode)) {
    server.registerTool(
      'get_perspective_rules',
      {
        description: 'Read a custom perspective rule archive as structured JSON',
        inputSchema: z.strictObject({
          idOrName: z.string().describe('Custom perspective identifier or exact name'),
        }),
      },
      async ({ idOrName }) => respond(() => of.getPerspectiveRules(idOrName))
    );
  }

  if (canUseTool('update_perspective_rules', mode)) {
    server.registerTool(
      'update_perspective_rules',
      {
        description: 'Replace a custom perspective rule archive with a complete JSON definition',
        inputSchema: z.strictObject({
          idOrName: z.string().describe('Custom perspective identifier or exact name'),
          definition: perspectiveRulesSchema.describe(
            'Complete rule archive returned by get_perspective_rules'
          ),
        }),
      },
      async ({ idOrName, definition }) =>
        respond(() => of.updatePerspectiveRules(idOrName, definition))
    );
  }

  if (canUseTool('get_perspective_tasks', mode)) {
    server.registerTool(
      'get_perspective_tasks',
      {
        description: 'Get tasks from a specific perspective',
        inputSchema: z.strictObject({
          name: z
            .string()
            .describe('Perspective name (e.g., Inbox, Flagged, or custom perspective)'),
        }),
      },
      async ({ name }) => respond(() => of.getPerspectiveTasks(name))
    );
  }

  if (canUseTool('list_tags', mode)) {
    server.registerTool(
      'list_tags',
      {
        description: 'List all tags with optional filtering and sorting',
        inputSchema: z.strictObject({
          unusedDays: z.number().optional().describe('Only show tags unused for this many days'),
          sortBy: z.enum(['name', 'usage', 'activity']).optional().describe('Sort order'),
          activeOnly: z.boolean().optional().describe('Only count active tasks'),
        }),
      },
      async (options) => respond(() => of.listTags(options))
    );
  }

  if (canUseTool('get_tag', mode)) {
    server.registerTool(
      'get_tag',
      {
        description: 'Get a specific tag by ID or name',
        inputSchema: z.strictObject({
          idOrName: z.string().describe('Tag ID, name, or path (e.g., "Parent/Child")'),
        }),
      },
      async ({ idOrName }) => respond(() => of.getTag(idOrName))
    );
  }

  if (canUseTool('create_tag', mode)) {
    server.registerTool(
      'create_tag',
      { description: 'Create a new tag', inputSchema: tagCreate },
      async (options) => respond(() => of.createTag(options))
    );
  }

  if (canUseTool('update_tag', mode)) {
    server.registerTool(
      'update_tag',
      {
        description: 'Update tag fields or parent by ID, unique name, or path; null moves to root',
        inputSchema: tagUpdate.safeExtend({ idOrName: z.string() }),
      },
      async ({ idOrName, ...options }) => respond(() => of.updateTag(idOrName, options))
    );
  }

  if (canUseTool('delete_tag', mode)) {
    server.registerTool(
      'delete_tag',
      {
        description: 'Delete a tag',
        inputSchema: z.strictObject({ idOrName: z.string().describe('Tag ID, name, or path') }),
      },
      async ({ idOrName }) => {
        return respond(async () => {
          await of.deleteTag(idOrName);
          return { deleted: true };
        });
      }
    );
  }

  if (canUseTool('get_tag_stats', mode)) {
    server.registerTool(
      'get_tag_stats',
      { description: 'Get tag statistics', inputSchema: z.strictObject({}) },
      async () => respond(() => of.getTagStats())
    );
  }

  if (canUseTool('list_folders', mode)) {
    server.registerTool(
      'list_folders',
      {
        description: 'List all folders',
        inputSchema: z.strictObject({
          includeDropped: z.boolean().optional().describe('Include dropped folders'),
        }),
      },
      async (filters) => respond(() => of.listFolders(filters))
    );
  }

  if (canUseTool('get_folder', mode)) {
    server.registerTool(
      'get_folder',
      {
        description: 'Get a specific folder by ID or name',
        inputSchema: z.strictObject({
          idOrName: z.string().describe('Folder ID or name'),
          includeDropped: z.boolean().optional().describe('Include dropped children'),
        }),
      },
      async ({ idOrName, includeDropped }) =>
        respond(() => of.getFolder(idOrName, { includeDropped }))
    );
  }

  if (canUseTool('create_folder', mode)) {
    server.registerTool(
      'create_folder',
      {
        description: 'Create a top-level folder, or return an existing folder with the same name',
        inputSchema: z.strictObject({
          name: z.string().describe('Top-level folder name (exact match)'),
        }),
      },
      async ({ name }) => respond(() => of.createFolder(name))
    );
  }

  if (canUseTool('delete_folder', mode)) {
    server.registerTool(
      'delete_folder',
      {
        description: 'Delete an empty folder',
        inputSchema: z.strictObject({ idOrName: z.string() }),
      },
      async ({ idOrName }) =>
        respond(async () => {
          await of.deleteFolder(idOrName);
          return { deleted: true };
        })
    );
  }

  if (canUseTool('search_tools', mode)) {
    server.registerTool(
      'search_tools',
      {
        description:
          'Search for available tools by name or description using regex. Returns matching tool names.',
        inputSchema: z.strictObject({
          query: z
            .string()
            .describe(
              'Regex pattern to match against tool names and descriptions (case-insensitive)'
            ),
        }),
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
