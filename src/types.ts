export interface Task {
  id: string;
  name: string;
  note: string | null;
  completed: boolean;
  flagged: boolean;
  project: string | null;
  tags: string[];
  defer: string | null;
  due: string | null;
  estimatedMinutes: number | null;
  completionDate: string | null;
  added: string | null;
  modified: string | null;
}

export interface Project {
  id: string;
  name: string;
  note: string | null;
  status: 'active' | 'on hold' | 'dropped';
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
  project?: string;
  tag?: string;
}

export interface ProjectFilters {
  includeDropped?: boolean;
  status?: 'active' | 'on hold' | 'dropped';
  folder?: string;
}

export interface CreateTaskOptions {
  name: string;
  note?: string;
  project?: string;
  tags?: string[];
  defer?: string;
  due?: string;
  flagged?: boolean;
  estimatedMinutes?: number;
}

export interface UpdateTaskOptions {
  name?: string;
  note?: string;
  project?: string;
  tags?: string[];
  defer?: string;
  due?: string;
  flagged?: boolean;
  estimatedMinutes?: number;
  completed?: boolean;
}

export interface CreateProjectOptions {
  name: string;
  note?: string;
  folder?: string;
  sequential?: boolean;
  tags?: string[];
  status?: 'active' | 'on hold' | 'dropped';
}

export interface UpdateProjectOptions {
  name?: string;
  note?: string;
  folder?: string;
  sequential?: boolean;
  tags?: string[];
  status?: 'active' | 'on hold' | 'dropped';
}

export interface Perspective {
  id: string;
  name: string;
}

export interface Tag {
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
  sequentialProjects: number;
  parallelProjects: number;
  avgTasksPerProject: number;
  avgRemainingPerProject: number;
  avgCompletionRate: number;
  projectsWithMostTasks: Array<{ name: string; taskCount: number }>;
  projectsWithMostRemaining: Array<{ name: string; remainingCount: number }>;
}

export interface CreateTagOptions {
  name: string;
  parent?: string;
  status?: 'active' | 'on hold' | 'dropped';
}

export interface UpdateTagOptions {
  name?: string;
  status?: 'active' | 'on hold' | 'dropped';
}
