import type { z } from 'zod';
import type * as omni from './omni/runtime.js';
import type {
  taskCreate,
  taskUpdate,
  projectCreate,
  projectMutation,
  tagCreate,
  tagUpdate,
} from './lib/mutations.js';

// Result types follow the functions that produce them inside OmniFocus.
export type Task = ReturnType<typeof omni.serializeTask>;
export type Project = ReturnType<typeof omni.serializeProject>;
export type Tag = ReturnType<typeof omni.serializeTag>;
export type Folder = omni.SerializedFolder;
export type CreateFolderResult = ReturnType<typeof omni.createFolder>;
export type Perspective = ReturnType<typeof omni.listPerspectives>[number];
export type PerspectiveRulesResult = ReturnType<typeof omni.getPerspectiveRules>;
export type TaskStats = ReturnType<typeof omni.getTaskStats>;
export type ProjectStats = ReturnType<typeof omni.getProjectStats>;
export type TagStats = ReturnType<typeof omni.getTagStats>;

export type TaskFilters = Parameters<typeof omni.listTasks>[0];
export type ProjectFilters = Parameters<typeof omni.listProjects>[0];

export interface FolderFilters {
  includeDropped?: boolean;
}

export interface TagListOptions {
  unusedDays?: number;
  sortBy?: 'name' | 'usage' | 'activity';
  activeOnly?: boolean;
}

export type CreateTaskOptions = z.input<typeof taskCreate>;
export type UpdateTaskOptions = z.input<typeof taskUpdate>;
export type CreateProjectOptions = z.input<typeof projectCreate>;
export type UpdateProjectOptions = z.input<typeof projectMutation>;
export type CreateTagOptions = z.input<typeof tagCreate>;
export type UpdateTagOptions = z.input<typeof tagUpdate>;
