import type { z } from 'zod';
import type {
  taskCreate,
  taskUpdate,
  projectCreate,
  projectMutation,
  tagCreate,
  tagUpdate,
} from './lib/mutations.js';
export interface Task {
  projectId?: string | null;
  parentTaskId?: string | null;
  id: string;
  name: string;
  note: string | null;
  completed: boolean;
  dropped: boolean;
  effectivelyActive: boolean;
  flagged: boolean;
  project: string | null;
  tags: string[];
  defer: string | null;
  due: string | null;
  planned: string | null;
  estimatedMinutes: number | null;
  completionDate: string | null;
  added: string | null;
  modified: string | null;
}

export interface Project {
  type?: 'parallel' | 'sequential' | 'single-action';
  singleActionList?: boolean;
  folderId?: string | null;
  id: string;
  name: string;
  note: string | null;
  status: 'active' | 'on hold' | 'dropped' | 'done';
  folder: string | null;
  sequential: boolean;
  taskCount: number;
  remainingCount: number;
  tags: string[];
}

export interface TaskFilters {
  includeCompleted?: boolean;
  includeDropped?: boolean;
  flagged?: boolean;
  project?: string | null;
  tag?: string;
}

export interface ProjectFilters {
  includeDropped?: boolean;
  status?: 'active' | 'on hold' | 'dropped' | 'done';
  folder?: string | null;
}

export type CreateTaskOptions = z.input<typeof taskCreate>;

export type UpdateTaskOptions = z.input<typeof taskUpdate>;

export type CreateProjectOptions = z.input<typeof projectCreate>;

export type UpdateProjectOptions = z.input<typeof projectMutation>;

export interface Perspective {
  identifier?: string;
  id: string;
  name: string;
}

export interface Tag {
  parentId?: string | null;
  id: string;
  name: string;
  taskCount: number;
  remainingTaskCount: number;
  added: string | null;
  modified: string | null;
  lastActivity: string | null;
  active: boolean;
  status: 'active' | 'on hold' | 'dropped';
  parent: string | null;
  children: string[];
  allowsNextAction: boolean;
}

export interface Folder {
  id: string;
  name: string;
  status: 'active' | 'dropped';
  effectivelyActive: boolean;
  parent: string | null;
  projectCount: number;
  remainingProjectCount: number;
  folderCount: number;
  children: Folder[];
}

export interface FolderFilters {
  includeDropped?: boolean;
}

export interface CreateFolderResult extends Folder {
  alreadyExisted: boolean;
}

export interface TagListOptions {
  unusedDays?: number;
  sortBy?: 'name' | 'usage' | 'activity';
  activeOnly?: boolean;
}

export interface TagStats {
  totalTags: number;
  activeTags: number;
  tagsWithTasks: number;
  unusedTags: number;
  avgTasksPerTag: number;
  mostUsedTags: Array<{ name: string; taskCount: number }>;
  leastUsedTags: Array<{ name: string; taskCount: number }>;
  staleTags: Array<{ name: string; daysSinceActivity: number }>;
}

export interface TaskStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  flaggedTasks: number;
  overdueActiveTasks: number;
  avgEstimatedMinutes: number | null;
  tasksWithEstimates: number;
  completionRate: number;
  tasksByProject: Array<{ name: string; taskCount: number }>;
  tasksByTag: Array<{ name: string; taskCount: number }>;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  onHoldProjects: number;
  droppedProjects: number;
  doneProjects: number;
  sequentialProjects: number;
  parallelProjects: number;
  avgTasksPerProject: number;
  avgRemainingPerProject: number;
  avgCompletionRate: number;
  projectsWithMostTasks: Array<{ name: string; taskCount: number }>;
  projectsWithMostRemaining: Array<{ name: string; remainingCount: number }>;
}

export type CreateTagOptions = z.input<typeof tagCreate>;

export type UpdateTagOptions = z.input<typeof tagUpdate>;
