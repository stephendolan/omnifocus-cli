export type CapabilityMode = 'full' | 'read-only';

const READ_ONLY_TOOLS = new Set([
  'list_tasks',
  'get_task',
  'search_tasks',
  'get_task_stats',
  'list_inbox',
  'get_inbox_count',
  'list_projects',
  'get_project',
  'get_project_stats',
  'list_perspectives',
  'list_tags',
  'get_tag',
  'get_tag_stats',
  'list_folders',
  'get_folder',
  'search_tools',
]);

export function canUseTool(name: string, mode: CapabilityMode): boolean {
  return mode === 'full' || READ_ONLY_TOOLS.has(name);
}
