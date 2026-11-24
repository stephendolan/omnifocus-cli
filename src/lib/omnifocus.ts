import * as omni from '../omni/runtime.js';
import {
  composeOmniScript,
  decodeOmniResult,
  DEFAULT_TIMEOUT_MS,
  runOsascript,
  wrapOmniScript,
} from './bridge.js';
import { consentPreflight, OMNIFOCUS_BUNDLE_ID } from './consent.js';
import { OmniFocusError } from './errors.js';
import {
  parseMutation,
  taskCreate,
  taskUpdate,
  projectCreate,
  projectMutation,
  tagCreate,
  tagUpdate,
} from './mutations.js';
import { parsePerspectiveRules } from './perspective-rules.js';
import type {
  Task,
  Project,
  TaskFilters,
  ProjectFilters,
  CreateTaskOptions,
  UpdateTaskOptions,
  CreateProjectOptions,
  UpdateProjectOptions,
  Perspective,
  PerspectiveRulesResult,
  Tag,
  TagListOptions,
  TagStats,
  TaskStats,
  ProjectStats,
  CreateTagOptions,
  UpdateTagOptions,
  Folder,
  FolderFilters,
  CreateFolderResult,
} from '../types.js';

// get_perspective_tasks waits for OmniFocus to redraw the front window.
const PERSPECTIVE_TIMEOUT_MS = 60_000;

export class OmniFocus {
  private executeJXA = runOsascript;

  /**
   * Runs one runtime function inside OmniFocus and returns its value. The
   * script carries the moment this call stops waiting, so a call that times
   * out here cannot take effect later.
   */
  private async run<A, R>(
    writes: boolean,
    operation: (args: A) => R,
    args: A,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<R> {
    const deadline = Date.now() + timeoutMs;
    const script = wrapOmniScript(composeOmniScript(operation, args, deadline));
    try {
      return decodeOmniResult<R>(await this.executeJXA(script, timeoutMs));
    } catch (error) {
      if (!(error instanceof OmniFocusError)) throw error;
      if (!writes) {
        error.changes = 'none';
      } else if (error.code === 'timeout') {
        throw new OmniFocusError(
          'timeout',
          `${error.message} The write takes effect only if OmniFocus had already started it; read the object back before retrying.`,
          { cause: error.cause }
        );
      }
      throw error;
    }
  }

  /** Runs an operation that only reads, so no failure of it changes anything. */
  private read<R>(operation: () => R): Promise<R>;
  private read<A, R>(operation: (args: A) => R, args: A, timeoutMs?: number): Promise<R>;
  private read<A, R>(operation: (args: A) => R, args?: A, timeoutMs?: number): Promise<R> {
    return this.run(false, operation, args as A, timeoutMs);
  }

  /** Runs an operation that changes the database. */
  private write<A, R>(operation: (args: A) => R, args: A): Promise<R> {
    return this.run(true, operation, args);
  }

  async checkConsent(requestConsent = false) {
    const result = await this.executeJXA(`
      ${consentPreflight(requestConsent)}
      JSON.stringify({ status: 'granted', osStatus: 0 });
    `);
    return {
      ...JSON.parse(result),
      execPath: process.execPath,
      target: OMNIFOCUS_BUNDLE_ID,
      promptRequested: requestConsent,
    };
  }

  async listTasks(filters: TaskFilters = {}): Promise<Task[]> {
    return this.read(omni.listTasks, filters);
  }

  async getTask(idOrName: string): Promise<Task> {
    return this.read(omni.getTask, { idOrName });
  }

  async createTask(options: CreateTaskOptions): Promise<Task> {
    return this.write(omni.createTask, parseMutation(taskCreate, options));
  }

  async updateTask(idOrName: string, options: UpdateTaskOptions): Promise<Task> {
    const changes = parseMutation(taskUpdate, options, true);
    return this.write(omni.updateTask, { idOrName, changes });
  }

  async deleteTask(idOrName: string): Promise<void> {
    return this.write(omni.deleteTask, { idOrName });
  }

  async searchTasks(query: string): Promise<Task[]> {
    return this.read(omni.searchTasks, { query });
  }

  async listInboxTasks(): Promise<Task[]> {
    return this.read(omni.listInboxTasks);
  }

  async getInboxCount(): Promise<number> {
    return (await this.listInboxTasks()).length;
  }

  async getTaskStats(): Promise<TaskStats> {
    return this.read(omni.getTaskStats);
  }

  async listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
    return this.read(omni.listProjects, filters);
  }

  async getProject(idOrName: string): Promise<Project> {
    return this.read(omni.getProject, { idOrName });
  }

  async createProject(options: CreateProjectOptions): Promise<Project> {
    return this.write(omni.createProject, parseMutation(projectCreate, options));
  }

  async updateProject(idOrName: string, options: UpdateProjectOptions): Promise<Project> {
    const changes = parseMutation(projectMutation, options, true);
    return this.write(omni.updateProject, { idOrName, changes });
  }

  async deleteProject(idOrName: string): Promise<void> {
    return this.write(omni.deleteProject, { idOrName });
  }

  async getProjectStats(): Promise<ProjectStats> {
    return this.read(omni.getProjectStats);
  }

  async listPerspectives(): Promise<Perspective[]> {
    return this.read(omni.listPerspectives);
  }

  async getPerspectiveRules(idOrName: string): Promise<PerspectiveRulesResult> {
    return this.read(omni.getPerspectiveRules, { idOrName });
  }

  async updatePerspectiveRules(idOrName: string, input: unknown): Promise<PerspectiveRulesResult> {
    const definition = parsePerspectiveRules(input);
    return this.write(omni.updatePerspectiveRules, { idOrName, definition });
  }

  async getPerspectiveTasks(name: string): Promise<Task[]> {
    return this.read(omni.getPerspectiveTasks, { name }, PERSPECTIVE_TIMEOUT_MS);
  }

  async listTags(options: TagListOptions = {}): Promise<Tag[]> {
    const { sortBy, ...filters } = options;
    return this.sortTags(await this.read(omni.listTags, filters), sortBy);
  }

  private sortTags(tags: Tag[], sortBy: string = 'name'): Tag[] {
    const sortFns: Record<string, (a: Tag, b: Tag) => number> = {
      usage: (a, b) => b.taskCount - a.taskCount,
      activity: (a, b) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      },
      name: (a, b) => a.name.localeCompare(b.name),
    };

    return tags.sort(sortFns[sortBy] || sortFns.name);
  }

  async getTag(idOrName: string): Promise<Tag> {
    return this.read(omni.getTag, { idOrName });
  }

  async createTag(options: CreateTagOptions): Promise<Tag> {
    return this.write(omni.createTag, parseMutation(tagCreate, options));
  }

  async updateTag(idOrName: string, options: UpdateTagOptions): Promise<Tag> {
    const changes = parseMutation(tagUpdate, options, true);
    return this.write(omni.updateTag, { idOrName, changes });
  }

  async deleteTag(idOrName: string): Promise<void> {
    return this.write(omni.deleteTag, { idOrName });
  }

  async getTagStats(): Promise<TagStats> {
    return this.read(omni.getTagStats);
  }

  async listFolders(filters: FolderFilters = {}): Promise<Folder[]> {
    return this.read(omni.listFolders, filters);
  }

  async getFolder(idOrName: string, filters: FolderFilters = {}): Promise<Folder> {
    return this.read(omni.getFolder, { idOrName, includeDropped: filters.includeDropped });
  }

  async createFolder(name: string): Promise<CreateFolderResult> {
    return this.write(omni.createFolder, { name });
  }

  async deleteFolder(idOrName: string): Promise<void> {
    return this.write(omni.deleteFolder, { idOrName });
  }
}
