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

export interface Perspective {
  id: string;
  name: string;
}
