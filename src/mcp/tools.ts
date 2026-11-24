import { z } from 'zod';
import type { OmniFocus } from '../lib/omnifocus.js';
import {
  folderCreate,
  folderFilters,
  projectCreate,
  projectFilters,
  projectMutation,
  tagCreate,
  tagListOptions,
  tagUpdate,
  taskCreate,
  taskFilters,
  taskUpdate,
} from '../lib/mutations.js';
import { perspectiveRulesSchema } from '../lib/perspective-rules.js';

export interface ToolDefinition<Schema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  /**
   * Whether read-only mode registers the tool. False for every tool that
   * writes, and for get_perspective_tasks, which switches the front window.
   */
  readOnly: boolean;
  inputSchema: Schema;
  run(of: OmniFocus, args: z.output<Schema>): Promise<unknown>;
}

function tool<Schema extends z.ZodType>(definition: ToolDefinition<Schema>): ToolDefinition {
  return definition as unknown as ToolDefinition;
}

const noArguments = z.strictObject({});
const reference = (description: string) =>
  z.strictObject({ idOrName: z.string().describe(description) });

/**
 * Every OmniFocus-backed tool, in the order tools/list reports them. The server
 * registers tools from this list and search_tools searches it, so a name,
 * description, schema, and capability are each stated once.
 */
export const TOOLS: ToolDefinition[] = [
  tool({
    name: 'list_tasks',
    description: 'List tasks with optional filtering',
    readOnly: true,
    inputSchema: taskFilters,
    run: (of, filters) => of.listTasks(filters),
  }),
  tool({
    name: 'get_task',
    description: 'Get a specific task by ID or unique name',
    readOnly: true,
    inputSchema: reference('Task ID or unique name'),
    run: (of, { idOrName }) => of.getTask(idOrName),
  }),
  tool({
    name: 'create_task',
    description: 'Create a new task',
    readOnly: false,
    inputSchema: taskCreate,
    run: (of, options) => of.createTask(options),
  }),
  tool({
    name: 'update_task',
    description:
      'Update task fields, project placement, or order before/after an exact sibling task ID',
    readOnly: false,
    inputSchema: taskUpdate.safeExtend({ idOrName: z.string() }),
    run: (of, { idOrName, ...options }) => of.updateTask(idOrName, options),
  }),
  tool({
    name: 'delete_task',
    description: 'Delete a task',
    readOnly: false,
    inputSchema: reference('Task ID or unique name'),
    run: (of, { idOrName }) => of.deleteTask(idOrName),
  }),
  tool({
    name: 'search_tasks',
    description: 'Search tasks by name or note content',
    readOnly: true,
    inputSchema: z.strictObject({ query: z.string().describe('Search query') }),
    run: (of, { query }) => of.searchTasks(query),
  }),
  tool({
    name: 'get_task_stats',
    description: 'Get task statistics',
    readOnly: true,
    inputSchema: noArguments,
    run: (of) => of.getTaskStats(),
  }),
  tool({
    name: 'list_inbox',
    description: 'List remaining inbox tasks, including subtasks',
    readOnly: true,
    inputSchema: noArguments,
    run: (of) => of.listInboxTasks(),
  }),
  tool({
    name: 'get_inbox_count',
    description: 'Get the number of remaining inbox tasks',
    readOnly: true,
    inputSchema: noArguments,
    run: async (of) => ({ count: await of.getInboxCount() }),
  }),
  tool({
    name: 'list_projects',
    description: 'List projects with optional filtering',
    readOnly: true,
    inputSchema: projectFilters,
    run: (of, filters) => of.listProjects(filters),
  }),
  tool({
    name: 'get_project',
    description: 'Get a specific project by ID or unique name',
    readOnly: true,
    inputSchema: reference('Project ID or unique name'),
    run: (of, { idOrName }) => of.getProject(idOrName),
  }),
  tool({
    name: 'create_project',
    description: 'Create a project with folder and parallel, sequential, or single-action type',
    readOnly: false,
    inputSchema: projectCreate,
    run: (of, options) => of.createProject(options),
  }),
  tool({
    name: 'update_project',
    description:
      'Update project fields or reorder relative to a sibling project. Use one of before or after, without folder, status, or completed.',
    readOnly: false,
    inputSchema: projectMutation.safeExtend({ idOrName: z.string() }),
    run: (of, { idOrName, ...options }) => of.updateProject(idOrName, options),
  }),
  tool({
    name: 'delete_project',
    description: 'Delete a project',
    readOnly: false,
    inputSchema: reference('Project ID or unique name'),
    run: (of, { idOrName }) => of.deleteProject(idOrName),
  }),
  tool({
    name: 'get_project_stats',
    description: 'Get project statistics',
    readOnly: true,
    inputSchema: noArguments,
    run: (of) => of.getProjectStats(),
  }),
  tool({
    name: 'list_perspectives',
    description: 'List all available perspectives',
    readOnly: true,
    inputSchema: noArguments,
    run: (of) => of.listPerspectives(),
  }),
  tool({
    name: 'get_perspective_rules',
    description: 'Read a custom perspective rule archive as structured JSON',
    readOnly: true,
    inputSchema: reference('Custom perspective identifier or exact name'),
    run: (of, { idOrName }) => of.getPerspectiveRules(idOrName),
  }),
  tool({
    name: 'update_perspective_rules',
    description: 'Replace a custom perspective rule archive with a complete JSON definition',
    readOnly: false,
    inputSchema: z.strictObject({
      idOrName: z.string().describe('Custom perspective identifier or exact name'),
      definition: perspectiveRulesSchema.describe(
        'Complete rule archive returned by get_perspective_rules'
      ),
    }),
    run: (of, { idOrName, definition }) => of.updatePerspectiveRules(idOrName, definition),
  }),
  tool({
    name: 'get_perspective_tasks',
    description: 'Get tasks from a specific perspective',
    readOnly: false,
    inputSchema: z.strictObject({
      name: z.string().describe('Perspective name (e.g., Inbox, Flagged, or custom perspective)'),
    }),
    run: (of, { name }) => of.getPerspectiveTasks(name),
  }),
  tool({
    name: 'list_tags',
    description: 'List all tags with optional filtering and sorting',
    readOnly: true,
    inputSchema: tagListOptions,
    run: (of, options) => of.listTags(options),
  }),
  tool({
    name: 'get_tag',
    description: 'Get a specific tag by ID or name',
    readOnly: true,
    inputSchema: reference('Tag ID, name, or path (e.g., "Parent/Child")'),
    run: (of, { idOrName }) => of.getTag(idOrName),
  }),
  tool({
    name: 'create_tag',
    description: 'Create a new tag',
    readOnly: false,
    inputSchema: tagCreate,
    run: (of, options) => of.createTag(options),
  }),
  tool({
    name: 'update_tag',
    description: 'Update tag fields or parent by ID, unique name, or path; null moves to root',
    readOnly: false,
    inputSchema: tagUpdate.safeExtend({ idOrName: z.string() }),
    run: (of, { idOrName, ...options }) => of.updateTag(idOrName, options),
  }),
  tool({
    name: 'delete_tag',
    description: 'Delete a tag',
    readOnly: false,
    inputSchema: reference('Tag ID, name, or path'),
    run: (of, { idOrName }) => of.deleteTag(idOrName),
  }),
  tool({
    name: 'get_tag_stats',
    description: 'Get tag statistics',
    readOnly: true,
    inputSchema: noArguments,
    run: (of) => of.getTagStats(),
  }),
  tool({
    name: 'list_folders',
    description: 'List all folders',
    readOnly: true,
    inputSchema: folderFilters,
    run: (of, filters) => of.listFolders(filters),
  }),
  tool({
    name: 'get_folder',
    description: 'Get a specific folder by ID or unique name',
    readOnly: true,
    inputSchema: z.strictObject({
      idOrName: z.string().describe('Folder ID or unique name'),
      includeDropped: z.boolean().optional().describe('Include dropped children'),
    }),
    run: (of, { idOrName, includeDropped }) => of.getFolder(idOrName, { includeDropped }),
  }),
  tool({
    name: 'create_folder',
    description:
      'Create or reuse a folder with an exact name under the selected parent or library root',
    readOnly: false,
    inputSchema: folderCreate,
    run: (of, { name, parent }) => of.createFolder(name, parent),
  }),
  tool({
    name: 'delete_folder',
    description: 'Delete an empty folder',
    readOnly: false,
    inputSchema: reference('Folder ID or unique name'),
    run: (of, { idOrName }) => of.deleteFolder(idOrName),
  }),
];
