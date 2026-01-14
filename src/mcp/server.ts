import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OmniFocus } from '../lib/omnifocus.js';

const toolRegistry = [
  { name: 'list_tasks', description: 'List tasks with optional filtering' },
  { name: 'get_task', description: 'Get a specific task by ID or name' },
  { name: 'create_task', description: 'Create a new task' },
  { name: 'update_task', description: 'Update an existing task' },
  { name: 'delete_task', description: 'Delete a task' },
  { name: 'search_tasks', description: 'Search tasks by name or note content' },
  { name: 'get_task_stats', description: 'Get task statistics' },
  { name: 'list_inbox', description: 'List all inbox tasks' },
  { name: 'get_inbox_count', description: 'Get the number of inbox tasks' },
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

const server = new McpServer({
  name: 'omnifocus',
  version: '1.0.0',
});

const of = new OmniFocus();

function jsonResponse(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

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
  async (filters) => jsonResponse(await of.listTasks(filters))
);

server.tool(
  'get_task',
  'Get a specific task by ID or name',
  { idOrName: z.string().describe('Task ID or name') },
  async ({ idOrName }) => jsonResponse(await of.getTask(idOrName))
);

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
    flagged: z.boolean().optional().describe('Flag the task'),
    estimatedMinutes: z.number().optional().describe('Estimated duration in minutes'),
  },
  async (options) => jsonResponse(await of.createTask(options))
);

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
    flagged: z.boolean().optional().describe('Flag/unflag the task'),
    estimatedMinutes: z.number().optional().describe('New estimated duration'),
    completed: z.boolean().optional().describe('Mark complete/incomplete'),
  },
  async ({ idOrName, ...options }) => jsonResponse(await of.updateTask(idOrName, options))
);

server.tool(
  'delete_task',
  'Delete a task',
  { idOrName: z.string().describe('Task ID or name') },
  async ({ idOrName }) => {
    await of.deleteTask(idOrName);
    return jsonResponse({ deleted: true });
  }
);

server.tool(
  'search_tasks',
  'Search tasks by name or note content',
  { query: z.string().describe('Search query') },
  async ({ query }) => jsonResponse(await of.searchTasks(query))
);

server.tool('get_task_stats', 'Get task statistics', {}, async () => jsonResponse(await of.getTaskStats()));

server.tool('list_inbox', 'List all inbox tasks', {}, async () => jsonResponse(await of.listInboxTasks()));

server.tool('get_inbox_count', 'Get the number of inbox tasks', {}, async () =>
  jsonResponse({ count: await of.getInboxCount() })
);

server.tool(
  'list_projects',
  'List projects with optional filtering',
  {
    includeDropped: z.boolean().optional().describe('Include dropped projects'),
    status: z.enum(['active', 'on hold', 'dropped']).optional().describe('Filter by status'),
    folder: z.string().optional().describe('Filter by folder name'),
  },
  async (filters) => jsonResponse(await of.listProjects(filters))
);

server.tool(
  'get_project',
  'Get a specific project by ID or name',
  { idOrName: z.string().describe('Project ID or name') },
  async ({ idOrName }) => jsonResponse(await of.getProject(idOrName))
);

server.tool(
  'create_project',
  'Create a new project',
  {
    name: z.string().describe('Project name'),
    note: z.string().optional().describe('Project note'),
    folder: z.string().optional().describe('Folder to create project in'),
    sequential: z.boolean().optional().describe('Sequential project (tasks must be done in order)'),
    tags: z.array(z.string()).optional().describe('Tags to assign'),
    status: z.enum(['active', 'on hold', 'dropped']).optional().describe('Initial status'),
  },
  async (options) => jsonResponse(await of.createProject(options))
);

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
  async ({ idOrName, ...options }) => jsonResponse(await of.updateProject(idOrName, options))
);

server.tool(
  'delete_project',
  'Delete a project',
  { idOrName: z.string().describe('Project ID or name') },
  async ({ idOrName }) => {
    await of.deleteProject(idOrName);
    return jsonResponse({ deleted: true });
  }
);

server.tool('get_project_stats', 'Get project statistics', {}, async () => jsonResponse(await of.getProjectStats()));

server.tool('list_perspectives', 'List all available perspectives', {}, async () =>
  jsonResponse(await of.listPerspectives())
);

server.tool(
  'get_perspective_tasks',
  'Get tasks from a specific perspective',
  { name: z.string().describe('Perspective name (e.g., Inbox, Flagged, or custom perspective)') },
  async ({ name }) => jsonResponse(await of.getPerspectiveTasks(name))
);

server.tool(
  'list_tags',
  'List all tags with optional filtering and sorting',
  {
    unusedDays: z.number().optional().describe('Only show tags unused for this many days'),
    sortBy: z.enum(['name', 'usage', 'activity']).optional().describe('Sort order'),
    activeOnly: z.boolean().optional().describe('Only count active tasks'),
  },
  async (options) => jsonResponse(await of.listTags(options))
);

server.tool(
  'get_tag',
  'Get a specific tag by ID or name',
  { idOrName: z.string().describe('Tag ID, name, or path (e.g., "Parent/Child")') },
  async ({ idOrName }) => jsonResponse(await of.getTag(idOrName))
);

server.tool(
  'create_tag',
  'Create a new tag',
  {
    name: z.string().describe('Tag name'),
    parent: z.string().optional().describe('Parent tag name or path'),
    status: z.enum(['active', 'on hold', 'dropped']).optional().describe('Initial status'),
  },
  async (options) => jsonResponse(await of.createTag(options))
);

server.tool(
  'update_tag',
  'Update an existing tag',
  {
    idOrName: z.string().describe('Tag ID, name, or path'),
    name: z.string().optional().describe('New tag name'),
    status: z.enum(['active', 'on hold', 'dropped']).optional().describe('New status'),
  },
  async ({ idOrName, ...options }) => jsonResponse(await of.updateTag(idOrName, options))
);

server.tool(
  'delete_tag',
  'Delete a tag',
  { idOrName: z.string().describe('Tag ID, name, or path') },
  async ({ idOrName }) => {
    await of.deleteTag(idOrName);
    return jsonResponse({ deleted: true });
  }
);

server.tool('get_tag_stats', 'Get tag statistics', {}, async () => jsonResponse(await of.getTagStats()));

server.tool(
  'list_folders',
  'List all folders',
  { includeDropped: z.boolean().optional().describe('Include dropped folders') },
  async (filters) => jsonResponse(await of.listFolders(filters))
);

server.tool(
  'get_folder',
  'Get a specific folder by ID or name',
  {
    idOrName: z.string().describe('Folder ID or name'),
    includeDropped: z.boolean().optional().describe('Include dropped children'),
  },
  async ({ idOrName, includeDropped }) => jsonResponse(await of.getFolder(idOrName, { includeDropped }))
);

server.tool(
  'search_tools',
  'Search for available tools by name or description using regex. Returns matching tool names.',
  {
    query: z.string().describe('Regex pattern to match against tool names and descriptions (case-insensitive)'),
  },
  async ({ query }) => {
    try {
      const pattern = new RegExp(query, 'i');
      const matches = toolRegistry.filter((t) => pattern.test(t.name) || pattern.test(t.description));
      return jsonResponse({ tools: matches });
    } catch {
      return jsonResponse({ error: 'Invalid regex pattern' });
    }
  }
);

export async function runMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
