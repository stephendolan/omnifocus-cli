/**
 * Omni Automation runtime: every function here executes inside OmniFocus.
 *
 * The bridge sends each function's source text through evaluateJavascript, so a
 * function can use only its parameters, other functions exported from this
 * file, the Omni Automation globals (globals.ts, omniautomation.d.ts), and
 * ECMAScript built-ins. Nothing from Node, and no module-level state, exists
 * where this code runs. The file therefore has no imports and no top-level
 * statements other than exported functions and types; runtime.test.ts checks
 * both, and `tsc -p src/omni` checks it without Node or Bun globals in scope.
 */

export type OmniErrorCode =
  | 'not_found'
  | 'ambiguous'
  | 'invalid'
  | 'verification_failed'
  | 'partial_write'
  | 'expired'
  | 'script_error';

export interface OmniFailure {
  code: string;
  name: string;
  message: string;
  /** Present when the runtime knows what the failed request left behind. */
  changes?: string;
}

export type ProjectStatusName = 'active' | 'on hold' | 'dropped' | 'done';
export type TagStatusName = 'active' | 'on hold' | 'dropped';
export type ProjectTypeName = 'parallel' | 'sequential' | 'single-action';

export interface TaskChanges {
  name?: string;
  note?: string;
  project?: string | null;
  tags?: string[];
  defer?: string | null;
  due?: string | null;
  planned?: string | null;
  flagged?: boolean;
  estimatedMinutes?: number;
  completed?: boolean;
  dropped?: boolean;
  before?: string;
  after?: string;
}

export interface ProjectChanges {
  name?: string;
  note?: string;
  folder?: string | null;
  sequential?: boolean;
  tags?: string[];
  status?: ProjectStatusName;
  type?: ProjectTypeName;
  singleActionList?: boolean;
  completed?: boolean;
}

export interface TagChanges {
  name?: string;
  status?: TagStatusName;
  parent?: string | null;
  parentId?: string | null;
}

export interface SerializedFolder {
  id: string;
  name: string;
  status: 'active' | 'dropped';
  effectivelyActive: boolean;
  parent: string | null;
  projectCount: number;
  remainingProjectCount: number;
  folderCount: number;
  children: SerializedFolder[];
}

export interface PerspectiveRules {
  archivedFilterRules: unknown[];
  archivedTopLevelFilterAggregation: string | null;
}

/** A write that reads its result back. */
export interface CheckedWrite {
  field: string;
  apply(): void;
  verify(): boolean;
}

/** A checked write that can put back the value it replaced. */
export interface ReversibleWrite extends CheckedWrite {
  undo(): void;
  undone(): boolean;
}

// Entry point and errors

/**
 * Runs one operation and reports its value or failure as a JSON envelope.
 *
 * `deadline` is when the caller stops waiting, in epoch milliseconds. A call
 * the caller gave up on can still sit in OmniFocus's queue and run much later,
 * so a script that starts past its deadline does nothing.
 */
export function invoke<A, R>(operation: (args: A) => R, args: A, deadline: number): string {
  try {
    if (Date.now() > deadline) {
      fail('expired', 'The request expired before OmniFocus ran it; nothing was changed');
    }
    return JSON.stringify({ ok: true, value: operation(args) });
  } catch (error) {
    const thrown = (error ?? {}) as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
      changes?: unknown;
    };
    const failure: OmniFailure = {
      code: typeof thrown.code === 'string' ? thrown.code : 'script_error',
      name: String(thrown.name ?? 'Error'),
      message: String(thrown.message ?? error),
    };
    if (typeof thrown.changes === 'string') failure.changes = thrown.changes;
    return JSON.stringify({ ok: false, error: failure });
  }
}

export function fail(code: OmniErrorCode, message: string, changes?: 'unknown'): never {
  throw Object.assign(new Error(message), changes ? { code, changes } : { code });
}

export function messageOf(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? error);
}

/**
 * Marks a failure whose writes were all undone and checked, so the caller
 * learns that nothing changed even when the failure itself is unexpected.
 */
export function unchanged(error: unknown): unknown {
  try {
    if (typeof error === 'object' && error !== null) {
      (error as { changes?: string }).changes = 'none';
    }
  } catch {
    // An error that cannot carry the mark is reported with its default outcome.
  }
  return error;
}

// Identity and lookup

/** Compares two database objects of the same class by ID, never by wrapper identity. */
export function sameObject(a: DatabaseObject | null, b: DatabaseObject | null): boolean {
  if (!a || !b) return !a && !b;
  return a.id.primaryKey === b.id.primaryKey;
}

export function indexOfObject(list: DatabaseObject[], object: DatabaseObject): number {
  return list.findIndex((item) => item.id.primaryKey === object.id.primaryKey);
}

export function sortedIds(list: DatabaseObject[]): string {
  return list
    .map((item) => item.id.primaryKey)
    .sort()
    .join(',');
}

/**
 * Resolves a reference that is an ID or an exact name. A name shared by more
 * than one object is rejected rather than settled by database order, and the
 * error lists candidates' IDs so the caller can choose. Current objects come
 * first and the list is capped, because a repeating task can share its name
 * with thousands of finished occurrences.
 */
export function resolveUnique<T extends { id: ObjectIdentifier; name: string }>(
  collection: T[],
  reference: string,
  kind: string,
  describe: (item: T) => string,
  isCurrent: (item: T) => boolean
): T {
  const byId = collection.find((item) => item.id.primaryKey === reference);
  if (byId) return byId;
  const matches = collection.filter((item) => item.name === reference);
  if (matches.length > 1) {
    const ordered = matches.filter(isCurrent).concat(matches.filter((item) => !isCurrent(item)));
    const shown = ordered.slice(0, 10).map((item) => `${item.id.primaryKey} (${describe(item)})`);
    const rest = ordered.length - shown.length;
    fail(
      'ambiguous',
      `Multiple ${kind} matches: ${reference}. Use an ID: ${shown.join(', ')}` +
        (rest > 0 ? `, and ${rest} more` : '')
    );
  }
  if (matches.length === 0) fail('not_found', `${kind} not found: ${reference}`);
  return matches[0];
}

export function resolveFolder(reference: string): Folder {
  return resolveUnique(
    flattenedFolders,
    reference,
    'Folder',
    (folder) => (folder.parent ? `in ${folder.parent.name}` : 'top level'),
    (folder) => folder.effectiveActive
  );
}

export function resolveProject(reference: string): Project {
  return resolveUnique(
    flattenedProjects,
    reference,
    'Project',
    (project) => projectStatusName(project.status),
    projectIsRemaining
  );
}

export function resolveTask(reference: string): Task {
  return resolveUnique(
    flattenedTasks,
    reference,
    'Task',
    (task) => {
      const state = task.completed ? 'completed' : task.dropDate ? 'dropped' : 'remaining';
      return isProjectRoot(task) ? `project, ${state}` : state;
    },
    (task) => !task.completed && !task.dropDate
  );
}

/** A project's root task: the task OmniFocus keeps for the project itself. */
export function isProjectRoot(task: Task): boolean {
  const project = task.containingProject;
  return !!project && sameObject(task, project.task);
}

export function tagPath(tag: Tag): string {
  const parts = [tag.name];
  for (let current = tag.parent; current; current = current.parent) parts.unshift(current.name);
  return parts.join('/');
}

/** Every tag a filter reference names: by ID, by path, or by a name several tags may share. */
export function tagsMatching(reference: string): Tag[] {
  const matches = flattenedTags.filter(
    (tag) => tag.id.primaryKey === reference || tag.name === reference || tagPath(tag) === reference
  );
  if (matches.length === 0) fail('not_found', `Tag not found: ${reference}`);
  return matches;
}

/** Every folder a filter reference names: by ID, or by a name several folders may share. */
export function foldersMatching(reference: string): Folder[] {
  const matches = flattenedFolders.filter(
    (folder) => folder.id.primaryKey === reference || folder.name === reference
  );
  if (matches.length === 0) fail('not_found', `Folder not found: ${reference}`);
  return matches;
}

export function uniqueObjects<T extends DatabaseObject>(list: T[]): T[] {
  return list.filter((item, index) => indexOfObject(list, item) === index);
}

export function findTag(idOrName: string): Tag {
  const byId = flattenedTags.find((tag) => tag.id.primaryKey === idOrName);
  if (byId) return byId;
  if (idOrName.includes('/')) {
    const atPath = flattenedTags.filter((tag) => tagPath(tag) === idOrName);
    if (atPath.length > 1) fail('ambiguous', `Multiple tags found at path: ${idOrName}`);
    if (atPath.length === 1) return atPath[0];
  }
  const named = flattenedTags.filter((tag) => tag.name === idOrName);
  if (named.length === 0) fail('not_found', `Tag not found: ${idOrName}`);
  if (named.length > 1) {
    fail(
      'ambiguous',
      `Multiple tags found with name '${idOrName}'. Please use full path:\n  ` +
        named.map(tagPath).join('\n  ') +
        `\nOr use tag ID: ${named.map((tag) => tag.id.primaryKey).join(', ')}`
    );
  }
  return named[0];
}

export function findCustomPerspective(idOrName: string): Perspective.Custom {
  const byId = Perspective.Custom.byIdentifier(idOrName);
  if (byId) return byId;
  const matches = Perspective.Custom.all.filter((perspective) => perspective.name === idOrName);
  if (matches.length > 1) {
    fail('ambiguous', `Multiple perspectives named: ${idOrName}. Use an identifier.`);
  }
  if (matches.length === 1) return matches[0];
  const builtInNames = [
    'inbox',
    'flagged',
    'forecast',
    'projects',
    'tags',
    'nearby',
    'review',
    'search',
    'completed',
    'changed',
  ];
  if (
    builtInNames.includes(idOrName.toLowerCase()) ||
    Perspective.BuiltIn.all.some((perspective) => perspective.name === idOrName)
  ) {
    fail('invalid', `Built-in perspective has no editable rules: ${idOrName}`);
  }
  return fail('not_found', `Perspective not found: ${idOrName}`);
}

// Status and type names

export function projectStatusName(status: Project.Status): ProjectStatusName {
  if (status === Project.Status.Active) return 'active';
  if (status === Project.Status.OnHold) return 'on hold';
  if (status === Project.Status.Dropped) return 'dropped';
  if (status === Project.Status.Done) return 'done';
  throw new Error('OmniFocus returned an unknown project status');
}

export function projectStatusNamed(name: ProjectStatusName): Project.Status {
  if (name === 'active') return Project.Status.Active;
  if (name === 'on hold') return Project.Status.OnHold;
  if (name === 'dropped') return Project.Status.Dropped;
  if (name === 'done') return Project.Status.Done;
  return fail('invalid', `Invalid status: ${name}`);
}

export function tagStatusName(status: Tag.Status): TagStatusName {
  if (status === Tag.Status.Active) return 'active';
  if (status === Tag.Status.OnHold) return 'on hold';
  if (status === Tag.Status.Dropped) return 'dropped';
  throw new Error('OmniFocus returned an unknown tag status');
}

export function tagStatusNamed(name: TagStatusName): Tag.Status {
  if (name === 'active') return Tag.Status.Active;
  if (name === 'on hold') return Tag.Status.OnHold;
  if (name === 'dropped') return Tag.Status.Dropped;
  return fail('invalid', `Invalid status: ${name}`);
}

export function projectType(project: Project): ProjectTypeName {
  if (project.containsSingletonActions) return 'single-action';
  return project.sequential ? 'sequential' : 'parallel';
}

/** A project that is neither dropped nor done, in a folder that is not dropped. */
export function projectIsRemaining(project: Project): boolean {
  if (project.status === Project.Status.Dropped || project.status === Project.Status.Done) {
    return false;
  }
  return !project.parentFolder || project.parentFolder.effectiveActive;
}

// Serializers

export function isoDate(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function serializeTask(task: Task) {
  const containingProject = task.containingProject;
  const parent = task.parent;
  const isTopLevel = !parent || (!!containingProject && sameObject(parent, containingProject.task));
  return {
    id: task.id.primaryKey,
    name: task.name,
    note: task.note || null,
    completed: task.completed,
    dropped: Boolean(task.dropDate),
    effectivelyActive: task.effectiveActive,
    flagged: task.flagged,
    project: containingProject ? containingProject.name : null,
    projectId: containingProject ? containingProject.id.primaryKey : null,
    parentTaskId: parent && !isTopLevel ? parent.id.primaryKey : null,
    tags: task.tags.map((tag) => tag.name),
    defer: isoDate(task.deferDate),
    due: isoDate(task.dueDate),
    planned: isoDate(task.plannedDate),
    estimatedMinutes: task.estimatedMinutes || null,
    completionDate: isoDate(task.completionDate),
    added: isoDate(task.added),
    modified: isoDate(task.modified),
  };
}

export function serializeProject(project: Project) {
  const parentFolder = project.parentFolder;
  const allTasks = project.flattenedTasks;
  return {
    id: project.id.primaryKey,
    name: project.name,
    note: project.note || null,
    status: projectStatusName(project.status),
    folder: parentFolder ? parentFolder.name : null,
    sequential: project.sequential,
    type: projectType(project),
    singleActionList: Boolean(project.containsSingletonActions),
    folderId: parentFolder ? parentFolder.id.primaryKey : null,
    taskCount: allTasks.length,
    remainingCount: allTasks.filter((task) => !task.completed).length,
    tags: project.tags.map((tag) => tag.name),
  };
}

export function serializeFolder(folder: Folder, includeDropped: boolean): SerializedFolder {
  const children = includeDropped
    ? folder.folders
    : folder.folders.filter((child) => child.effectiveActive);
  return {
    id: folder.id.primaryKey,
    name: folder.name,
    status: folder.status === Folder.Status.Active ? 'active' : 'dropped',
    effectivelyActive: folder.effectiveActive,
    parent: folder.parent ? folder.parent.name : null,
    projectCount: folder.projects.length,
    remainingProjectCount: folder.projects.filter(projectIsRemaining).length,
    folderCount: folder.folders.length,
    children: children.map((child) => serializeFolder(child, includeDropped)),
  };
}

export function serializeTag(tag: Tag, activeOnly: boolean) {
  const remainingTasks = tag.remainingTasks;
  const includedTasks = activeOnly ? remainingTasks : tag.tasks;

  const dates: Date[] = [];
  if (tag.added) dates.push(tag.added);
  if (tag.modified) dates.push(tag.modified);
  for (const task of includedTasks) {
    if (task.added) dates.push(task.added);
    if (task.modified) dates.push(task.modified);
    if (!activeOnly && task.completionDate) dates.push(task.completionDate);
    if (!activeOnly && task.effectiveCompletionDate) dates.push(task.effectiveCompletionDate);
  }
  const lastActivity = dates.length
    ? dates.reduce((latest, current) => (current > latest ? current : latest))
    : null;

  return {
    id: tag.id.primaryKey,
    name: tag.name,
    taskCount: includedTasks.length,
    remainingTaskCount: remainingTasks.length,
    added: isoDate(tag.added),
    modified: isoDate(tag.modified),
    lastActivity: isoDate(lastActivity),
    active: tag.active,
    status: tagStatusName(tag.status),
    parent: tag.parent ? tag.parent.name : null,
    parentId: tag.parent ? tag.parent.id.primaryKey : null,
    children: tag.children.map((child) => child.name),
    allowsNextAction: tag.allowsNextAction,
  };
}

// Verified writes

/**
 * Applies every reversible write, then reads each one back. If any write or
 * check fails, the writes already made are undone in reverse order and the
 * undo is checked too. Lifecycle writes (complete, drop) run last. They are
 * read back but never undone, so a failure there is a partial write.
 */
export function commit(writes: ReversibleWrite[], lifecycle: CheckedWrite[]): void {
  const applied: ReversibleWrite[] = [];
  try {
    for (const write of writes) {
      applied.push(write);
      write.apply();
    }
    for (const write of writes) {
      if (!write.verify()) fail('verification_failed', `Write verification failed: ${write.field}`);
    }
  } catch (error) {
    const failures: string[] = [];
    for (const write of applied.reverse()) {
      try {
        write.undo();
        if (!write.undone()) failures.push(`${write.field} was not restored`);
      } catch (undoError) {
        failures.push(`${write.field}: ${messageOf(undoError)}`);
      }
    }
    if (failures.length) {
      fail('partial_write', `${messageOf(error)}; restoration failed: ${failures.join('; ')}`);
    }
    throw unchanged(error);
  }

  try {
    for (const write of lifecycle) {
      write.apply();
      if (!write.verify()) fail('verification_failed', `Write verification failed: ${write.field}`);
    }
  } catch (error) {
    fail(
      'partial_write',
      `${messageOf(error)}; lifecycle write outcome may be partial; read before retrying`
    );
  }
}

export function propertyWrite<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
  field: string
): ReversibleWrite {
  const original = target[key];
  return {
    field,
    apply() {
      target[key] = value;
    },
    verify() {
      return target[key] === value;
    },
    undo() {
      target[key] = original;
    },
    undone() {
      return target[key] === original;
    },
  };
}

/**
 * A note reduced to the text OmniFocus keeps. OmniFocus rewrites a note as it
 * stores it: CR and CRLF line endings and the Unicode line and paragraph
 * separators become line feeds, control characters and a byte order mark are
 * dropped, and whitespace at either end is trimmed. Two notes with the same
 * text here are the same note.
 *
 * Written with character codes rather than a pattern, so that no line
 * separator ever appears in this function's source text.
 */
export function noteText(note: string): string {
  let text = '';
  for (let index = 0; index < note.length; index++) {
    const code = note.charCodeAt(index);
    if (code === 13) {
      text += '\n';
      if (note.charCodeAt(index + 1) === 10) index++;
    } else if (code === 0x2028 || code === 0x2029) {
      text += '\n';
    } else if (code === 0xfeff || (code < 32 && code !== 9 && code !== 10)) {
      continue;
    } else {
      text += note[index];
    }
  }
  return text.trim();
}

/**
 * Writes a note and checks that OmniFocus kept its text. An exact comparison
 * would fail every note that ends in a newline or uses CRLF line endings.
 */
export function noteWrite(target: { note: string }, value: string): ReversibleWrite {
  const original = target.note;
  return {
    field: 'note',
    apply() {
      target.note = value;
    },
    verify() {
      return noteText(target.note) === noteText(value);
    },
    undo() {
      target.note = original;
    },
    undone() {
      return noteText(target.note) === noteText(original);
    },
  };
}

export function dateWrite(
  task: Task,
  key: 'deferDate' | 'dueDate' | 'plannedDate',
  value: string | null,
  field: string
): ReversibleWrite {
  const original = task[key];
  const requested = value ? new Date(value) : null;
  const holds = (expected: Date | null) => {
    const actual = task[key];
    return (actual ? actual.getTime() : null) === (expected ? expected.getTime() : null);
  };
  return {
    field,
    apply() {
      task[key] = requested;
    },
    verify() {
      return holds(requested);
    },
    undo() {
      task[key] = original;
    },
    undone() {
      return holds(original);
    },
  };
}

/**
 * `addTag` is passed in because Task.addTag and Project.addTag declare
 * different parameters, and each must be called as it is declared.
 */
export function tagsWrite(
  target: { readonly tags: Tag[]; clearTags(): void },
  addTag: (tag: Tag) => void,
  requested: Tag[]
): ReversibleWrite {
  const original = Array.from(target.tags);
  const replace = (next: Tag[]) => {
    target.clearTags();
    for (const tag of next) addTag(tag);
  };
  return {
    field: 'tags',
    apply() {
      replace(requested);
    },
    verify() {
      return sortedIds(target.tags) === sortedIds(requested);
    },
    undo() {
      replace(original);
    },
    undone() {
      return sortedIds(target.tags) === sortedIds(original);
    },
  };
}

// Task placement

/** The tasks that share a task's parent: a parent task's children, or the top of the inbox. */
export function siblingTasks(task: Task): Task[] {
  return Array.from(task.parent ? task.parent.tasks : inbox);
}

export function nextSibling(task: Task): Task | null {
  const siblings = siblingTasks(task);
  const index = indexOfObject(siblings, task);
  return index === -1 ? null : (siblings[index + 1] ?? null);
}

export function areSiblings(a: Task, b: Task): boolean {
  if (a.parent || b.parent) return sameObject(a.parent, b.parent);
  return a.inInbox && b.inInbox;
}

/** Puts a task back before the sibling that followed it, or at the end of its old parent. */
export function restoreTaskPlacement(task: Task, parent: Task | null, next: Task | null): void {
  moveTasks([task], next ? next.before : parent ? parent.ending : inbox.ending);
}

export function taskProjectWrite(task: Task, project: Project | null): ReversibleWrite {
  const originalParent = task.parent;
  const originalNext = nextSibling(task);
  // Moving a task to the container it is already at the top of would send it to the end.
  const alreadyThere = project
    ? !!originalParent && sameObject(originalParent, project.task)
    : task.inInbox;
  return {
    field: 'project',
    apply() {
      if (!alreadyThere) moveTasks([task], project ? project.ending : inbox.ending);
    },
    verify() {
      return sameObject(task.containingProject, project);
    },
    undo() {
      if (!alreadyThere) restoreTaskPlacement(task, originalParent, originalNext);
    },
    undone() {
      return sameObject(task.parent, originalParent) && sameObject(nextSibling(task), originalNext);
    },
  };
}

export function taskOrderWrite(task: Task, anchor: Task, before: boolean): ReversibleWrite {
  const originalParent = task.parent;
  const originalNext = nextSibling(task);
  return {
    field: 'order',
    apply() {
      moveTasks([task], before ? anchor.before : anchor.after);
    },
    verify() {
      const siblings = siblingTasks(task);
      const taskIndex = indexOfObject(siblings, task);
      const anchorIndex = indexOfObject(siblings, anchor);
      return (
        taskIndex !== -1 && anchorIndex !== -1 && taskIndex === anchorIndex + (before ? -1 : 1)
      );
    },
    undo() {
      restoreTaskPlacement(task, originalParent, originalNext);
    },
    undone() {
      return sameObject(task.parent, originalParent) && sameObject(nextSibling(task), originalNext);
    },
  };
}

export function taskCompletionWrite(task: Task, completed: boolean): CheckedWrite {
  return {
    field: 'completed',
    apply() {
      if (completed) task.markComplete(null);
      else task.markIncomplete();
    },
    verify() {
      return task.completed === completed;
    },
  };
}

export function taskDropWrite(task: Task, dropped: boolean): CheckedWrite {
  return {
    field: 'dropped',
    apply() {
      if (dropped) task.drop(false, null);
      else if (task.dropDate) task.active = true;
    },
    verify() {
      return Boolean(task.dropDate) === dropped;
    },
  };
}

export function applyTaskChanges(task: Task, changes: TaskChanges): void {
  // Every reference resolves before the first write.
  const requestedTags = changes.tags && uniqueObjects(changes.tags.map(findTag));
  if (changes.completed === true && task.repetitionRule) {
    fail(
      'invalid',
      'Repeating task completion requires occurrence-aware handling; no changes applied'
    );
  }
  const project =
    changes.project === undefined
      ? undefined
      : changes.project
        ? resolveProject(changes.project)
        : null;
  const anchorId = changes.before ?? changes.after;
  let anchor: Task | undefined;
  if (anchorId !== undefined) {
    anchor = flattenedTasks.find((candidate) => candidate.id.primaryKey === anchorId);
    if (!anchor) fail('not_found', `Task not found: ${anchorId}`);
    if (sameObject(anchor, task)) fail('invalid', 'Cannot order a task relative to itself');
    if (!areSiblings(anchor, task)) {
      fail('invalid', 'Ordering requires sibling tasks in the same container');
    }
  }

  const writes: ReversibleWrite[] = [];
  if (changes.name !== undefined) writes.push(propertyWrite(task, 'name', changes.name, 'name'));
  if (changes.note !== undefined) writes.push(noteWrite(task, changes.note));
  if (changes.flagged !== undefined) {
    writes.push(propertyWrite(task, 'flagged', changes.flagged, 'flagged'));
  }
  if (changes.estimatedMinutes !== undefined) {
    writes.push(
      propertyWrite(task, 'estimatedMinutes', changes.estimatedMinutes, 'estimatedMinutes')
    );
  }
  if (changes.due !== undefined) writes.push(dateWrite(task, 'dueDate', changes.due, 'due'));
  if (changes.defer !== undefined) {
    writes.push(dateWrite(task, 'deferDate', changes.defer, 'defer'));
  }
  if (changes.planned !== undefined) {
    writes.push(dateWrite(task, 'plannedDate', changes.planned, 'planned'));
  }
  if (project !== undefined) writes.push(taskProjectWrite(task, project));
  if (anchor) writes.push(taskOrderWrite(task, anchor, changes.before !== undefined));
  if (requestedTags) {
    writes.push(tagsWrite(task, (tag) => task.addTag(tag, null), requestedTags));
  }

  const lifecycle: CheckedWrite[] = [];
  if (changes.completed !== undefined) {
    lifecycle.push(taskCompletionWrite(task, changes.completed));
  }
  if (changes.dropped !== undefined) lifecycle.push(taskDropWrite(task, changes.dropped));

  commit(writes, lifecycle);
}

// Project and tag placement

export function sectionsIn(folder: Folder | null): Array<Project | Folder> {
  return Array.from(folder ? folder.sections : library);
}

export function nextSection(project: Project): Project | Folder | null {
  const sections = sectionsIn(project.parentFolder);
  const index = indexOfObject(sections, project);
  return index === -1 ? null : (sections[index + 1] ?? null);
}

export function projectFolderWrite(project: Project, folder: Folder | null): ReversibleWrite {
  const originalFolder = project.parentFolder;
  const originalNext = nextSection(project);
  const alreadyThere = sameObject(originalFolder, folder);
  return {
    field: 'folder',
    apply() {
      if (!alreadyThere) moveSections([project], folder ? folder.ending : library.ending);
    },
    verify() {
      return sameObject(project.parentFolder, folder);
    },
    undo() {
      if (alreadyThere) return;
      moveSections(
        [project],
        originalNext ? originalNext.before : originalFolder ? originalFolder.ending : library.ending
      );
    },
    undone() {
      return (
        sameObject(project.parentFolder, originalFolder) &&
        sameObject(nextSection(project), originalNext)
      );
    },
  };
}

export function tagsIn(parent: Tag | null): Tag[] {
  return Array.from(parent ? parent.children : tags);
}

export function nextTag(tag: Tag): Tag | null {
  const peers = tagsIn(tag.parent);
  const index = indexOfObject(peers, tag);
  return index === -1 ? null : (peers[index + 1] ?? null);
}

export function tagParentWrite(tag: Tag, parent: Tag | null): ReversibleWrite {
  const originalParent = tag.parent;
  const originalNext = nextTag(tag);
  const alreadyThere = sameObject(originalParent, parent);
  return {
    field: 'parent',
    apply() {
      if (!alreadyThere) moveTags([tag], parent ? parent.ending : tags.ending);
    },
    verify() {
      return sameObject(tag.parent, parent);
    },
    undo() {
      if (alreadyThere) return;
      moveTags(
        [tag],
        originalNext ? originalNext.before : originalParent ? originalParent.ending : tags.ending
      );
    },
    undone() {
      return sameObject(tag.parent, originalParent) && sameObject(nextTag(tag), originalNext);
    },
  };
}

export function applyProjectChanges(project: Project, changes: ProjectChanges): void {
  // Every reference resolves before the first write.
  const requestedTags = changes.tags && uniqueObjects(changes.tags.map(findTag));
  const folder =
    changes.folder === undefined
      ? undefined
      : changes.folder
        ? resolveFolder(changes.folder)
        : null;

  const writes: ReversibleWrite[] = [];
  if (changes.name !== undefined) writes.push(propertyWrite(project, 'name', changes.name, 'name'));
  if (changes.note !== undefined) writes.push(noteWrite(project, changes.note));

  if (
    changes.type !== undefined ||
    changes.singleActionList !== undefined ||
    changes.sequential !== undefined
  ) {
    if (
      project.containsSingletonActions &&
      changes.sequential === true &&
      changes.type === undefined &&
      changes.singleActionList !== false
    ) {
      fail(
        'invalid',
        'Single-action lists require type: sequential or singleActionList: false to convert'
      );
    }
    const singleAction =
      changes.type !== undefined
        ? changes.type === 'single-action'
        : (changes.singleActionList ?? Boolean(project.containsSingletonActions));
    const sequential =
      changes.type !== undefined
        ? changes.type === 'sequential'
        : singleAction
          ? false
          : (changes.sequential ?? project.sequential);
    writes.push(propertyWrite(project, 'sequential', sequential, 'sequential'));
    writes.push(
      propertyWrite(project, 'containsSingletonActions', singleAction, 'singleActionList')
    );
  }

  const status =
    changes.status ??
    (changes.completed === undefined ? undefined : changes.completed ? 'done' : 'active');
  if (status !== undefined) {
    writes.push(propertyWrite(project, 'status', projectStatusNamed(status), 'status'));
  }
  if (folder !== undefined) writes.push(projectFolderWrite(project, folder));
  if (requestedTags) {
    writes.push(tagsWrite(project, (tag) => project.addTag(tag), requestedTags));
  }

  commit(writes, []);
}

export function applyTagChanges(tag: Tag, changes: TagChanges): void {
  // Every reference resolves before the first write.
  let parent: Tag | null | undefined;
  if (changes.parent !== undefined || changes.parentId !== undefined) {
    const named =
      changes.parent === undefined ? undefined : changes.parent ? findTag(changes.parent) : null;
    const identified =
      changes.parentId === undefined
        ? undefined
        : changes.parentId
          ? findTag(changes.parentId)
          : null;
    if (named !== undefined && identified !== undefined && !sameObject(named, identified)) {
      fail('invalid', 'Conflicting parent and parentId');
    }
    parent = named === undefined ? identified : named;
    for (let current = parent ?? null; current; current = current.parent) {
      if (sameObject(current, tag)) {
        fail('invalid', 'Cannot move a tag under itself or its descendant');
      }
    }
  }

  const writes: ReversibleWrite[] = [];
  if (changes.name !== undefined) writes.push(propertyWrite(tag, 'name', changes.name, 'name'));
  if (changes.status !== undefined) {
    writes.push(propertyWrite(tag, 'status', tagStatusNamed(changes.status), 'status'));
  }
  if (parent !== undefined) writes.push(tagParentWrite(tag, parent));

  commit(writes, []);
}

/** Runs the writes that finish a new object, deleting the object if they fail. */
export function finishCreated<T extends DatabaseObject>(
  created: T,
  all: () => DatabaseObject[],
  kind: string,
  finish: () => void
): void {
  try {
    finish();
  } catch (error) {
    try {
      const id = created.id.primaryKey;
      deleteObject(created);
      if (all().some((item) => item.id.primaryKey === id)) {
        throw new Error(`Created ${kind} still exists`);
      }
    } catch (cleanupError) {
      fail(
        'partial_write',
        `${messageOf(error)}; created ${kind} cleanup failed: ${messageOf(cleanupError)}`
      );
    }
    // The object is gone, so nothing is left partial even if undoing its fields had failed.
    if ((error as { code?: unknown } | null)?.code === 'partial_write') {
      fail('verification_failed', `${messageOf(error)}; the new ${kind} was deleted`);
    }
    throw unchanged(error);
  }
}

/** Deletes an object, checks that it is gone, and reports which object that was. */
export function deleteVerified(
  object: DatabaseObject & { name: string },
  all: () => DatabaseObject[],
  kind: string
) {
  const id = object.id.primaryKey;
  const name = object.name;
  deleteObject(object);
  if (all().some((item) => item.id.primaryKey === id)) {
    fail('verification_failed', `${kind} still exists after deletion: ${id}`, 'unknown');
  }
  return { deleted: true, id, name };
}

// Task operations

export function listTasks(args: {
  includeCompleted?: boolean;
  includeDropped?: boolean;
  flagged?: boolean;
  project?: string;
  tag?: string;
}) {
  const project = args.project ? resolveProject(args.project) : null;
  const tagFilter = args.tag ? tagsMatching(args.tag) : null;
  const results = [];
  for (const task of project ? project.flattenedTasks : flattenedTasks) {
    if (!args.includeCompleted && task.completed) continue;
    if (!args.includeDropped && !task.effectiveActive) continue;
    // Next, DueSoon, and Overdue are all available; only Blocked is not.
    if (args.flagged && (!task.flagged || task.taskStatus === Task.Status.Blocked)) continue;
    if (tagFilter && !task.tags.some((tag) => indexOfObject(tagFilter, tag) !== -1)) continue;
    results.push(serializeTask(task));
  }
  return results;
}

export function getTask(args: { idOrName: string }) {
  return serializeTask(resolveTask(args.idOrName));
}

export function createTask(args: TaskChanges & { name: string }) {
  const project = args.project ? resolveProject(args.project) : null;
  args.tags?.forEach(findTag);
  const task = new Task(args.name, project ?? inbox.ending);
  // The project was resolved above; naming it by ID keeps it from being looked up by name again.
  const changes = { ...args, project: project ? project.id.primaryKey : args.project };
  finishCreated(
    task,
    () => flattenedTasks,
    'task',
    () => applyTaskChanges(task, changes)
  );
  return serializeTask(task);
}

export function updateTask(args: { idOrName: string; changes: TaskChanges }) {
  const task = resolveTask(args.idOrName);
  const placement =
    args.changes.project !== undefined ||
    args.changes.before !== undefined ||
    args.changes.after !== undefined;
  if (isProjectRoot(task)) {
    if (placement) {
      fail('invalid', `${task.name} is a project; a task update cannot move or reorder it`);
    }
    if (args.changes.completed !== undefined || args.changes.dropped !== undefined) {
      fail(
        'invalid',
        `${task.name} is a project; complete or drop it with a project update, not a task update`
      );
    }
  }
  applyTaskChanges(task, args.changes);
  return serializeTask(task);
}

export function deleteTask(args: { idOrName: string }) {
  const task = resolveTask(args.idOrName);
  if (isProjectRoot(task)) {
    fail('invalid', `${task.name} is a project; delete it as a project, not as a task`);
  }
  return deleteVerified(task, () => flattenedTasks, 'Task');
}

export function searchTasks(args: { query: string }) {
  const query = args.query.toLowerCase();
  const results = [];
  for (const task of flattenedTasks) {
    if (task.completed || !task.effectiveActive) continue;
    if (
      task.name.toLowerCase().includes(query) ||
      (task.note || '').toLowerCase().includes(query)
    ) {
      results.push(serializeTask(task));
    }
  }
  return results;
}

export function listInboxTasks() {
  const results: ReturnType<typeof serializeTask>[] = [];
  inbox.apply((task) => {
    if (!task.completed && task.effectiveActive) results.push(serializeTask(task));
    return null;
  });
  return results;
}

export function countInboxTasks(): number {
  let count = 0;
  inbox.apply((task) => {
    if (!task.completed && task.effectiveActive) count++;
    return null;
  });
  return count;
}

// Project operations

export function listProjects(args: {
  includeDropped?: boolean;
  status?: ProjectStatusName;
  folder?: string;
}) {
  const folderFilter = args.folder ? foldersMatching(args.folder) : null;
  const results = [];
  for (const project of flattenedProjects) {
    if (args.status) {
      if (projectStatusName(project.status) !== args.status) continue;
    } else if (!args.includeDropped && !projectIsRemaining(project)) {
      continue;
    }
    if (folderFilter) {
      const folder = project.parentFolder;
      if (!folder || indexOfObject(folderFilter, folder) === -1) continue;
    }
    results.push(serializeProject(project));
  }
  return results;
}

export function getProject(args: { idOrName: string }) {
  return serializeProject(resolveProject(args.idOrName));
}

export function createProject(args: ProjectChanges & { name: string }) {
  const folder = args.folder ? resolveFolder(args.folder) : null;
  args.tags?.forEach(findTag);
  const project = new Project(args.name, folder ?? library.ending);
  const changes = { ...args, folder: folder ? folder.id.primaryKey : args.folder };
  finishCreated(
    project,
    () => flattenedProjects,
    'project',
    () => applyProjectChanges(project, changes)
  );
  return serializeProject(project);
}

export function updateProject(args: { idOrName: string; changes: ProjectChanges }) {
  const project = resolveProject(args.idOrName);
  applyProjectChanges(project, args.changes);
  return serializeProject(project);
}

export function deleteProject(args: { idOrName: string }) {
  return deleteVerified(resolveProject(args.idOrName), () => flattenedProjects, 'Project');
}

// Tag operations

export function listTags(args: { activeOnly?: boolean; unusedDays?: number }) {
  const serialized = flattenedTags.map((tag) => serializeTag(tag, Boolean(args.activeOnly)));
  if (!args.unusedDays) return serialized;
  const cutoff = Date.now() - args.unusedDays * 24 * 60 * 60 * 1000;
  return serialized.filter(
    (tag) => !tag.lastActivity || new Date(tag.lastActivity).getTime() < cutoff
  );
}

export function getTag(args: { idOrName: string }) {
  return serializeTag(findTag(args.idOrName), false);
}

export function createTag(args: TagChanges & { name: string }) {
  const parent = args.parent ? findTag(args.parent) : null;
  const tag = new Tag(args.name, parent ?? tags.beginning);
  // By name, a parent called the same as the new tag would now be ambiguous.
  const changes = { ...args, parent: parent ? parent.id.primaryKey : args.parent };
  finishCreated(
    tag,
    () => flattenedTags,
    'tag',
    () => applyTagChanges(tag, changes)
  );
  return serializeTag(tag, false);
}

export function updateTag(args: { idOrName: string; changes: TagChanges }) {
  const tag = findTag(args.idOrName);
  applyTagChanges(tag, args.changes);
  return serializeTag(tag, false);
}

export function deleteTag(args: { idOrName: string }) {
  return deleteVerified(findTag(args.idOrName), () => flattenedTags, 'Tag');
}

// Folder operations

export function listFolders(args: { includeDropped?: boolean }) {
  const includeDropped = Boolean(args.includeDropped);
  return folders
    .filter((folder) => includeDropped || folder.effectiveActive)
    .map((folder) => serializeFolder(folder, includeDropped));
}

export function getFolder(args: { idOrName: string; includeDropped?: boolean }) {
  return serializeFolder(resolveFolder(args.idOrName), Boolean(args.includeDropped));
}

export function createFolder(args: { name: string }) {
  const existing = folders.find((folder) => folder.name === args.name) ?? null;
  const folder = existing ?? new Folder(args.name, library.ending);
  return { ...serializeFolder(folder, false), alreadyExisted: existing !== null };
}

export function deleteFolder(args: { idOrName: string }) {
  const folder = resolveFolder(args.idOrName);
  if (folder.projects.length || folder.folders.length) {
    fail('invalid', 'Folder must be empty to delete');
  }
  return deleteVerified(folder, () => flattenedFolders, 'Folder');
}

// Perspective operations

export function listPerspectives() {
  const results: Array<{ id: string; name: string; identifier?: string }> = [];
  for (const name of ['Inbox', 'Flagged', 'Forecast', 'Projects', 'Tags', 'Nearby', 'Review']) {
    results.push({ id: name, name });
  }
  for (const perspective of Perspective.Custom.all) {
    results.push({
      id: perspective.name,
      name: perspective.name,
      identifier: perspective.identifier,
    });
  }
  return results;
}

/** Switches the front window to a perspective and returns the tasks it shows. */
export function getPerspectiveTasks(args: { name: string }) {
  // The root TypeScript project sees the browser's `document` type here; see document.ts.
  const omniDocument = document as unknown as Database['document'];
  const frontWindow = omniDocument ? omniDocument.windows[0] : undefined;
  if (!frontWindow) {
    fail('invalid', 'No OmniFocus window is open. Please open an OmniFocus window and try again.');
  }
  const builtIn: Record<string, Perspective.BuiltIn> = {
    inbox: Perspective.BuiltIn.Inbox,
    flagged: Perspective.BuiltIn.Flagged,
    forecast: Perspective.BuiltIn.Forecast,
    projects: Perspective.BuiltIn.Projects,
    tags: Perspective.BuiltIn.Tags,
    nearby: Perspective.BuiltIn.Nearby,
    review: Perspective.BuiltIn.Review,
  };
  const key = args.name.toLowerCase();
  const perspective = Object.hasOwn(builtIn, key)
    ? builtIn[key]
    : Perspective.Custom.byIdentifier(args.name) || Perspective.Custom.byName(args.name);
  if (!perspective) fail('not_found', `Perspective not found: ${args.name}`);
  frontWindow.perspective = perspective;

  const content = frontWindow.content;
  if (!content) fail('invalid', 'No content available in window');
  const results: ReturnType<typeof serializeTask>[] = [];
  content.rootNode.apply((node) => {
    if (node.object instanceof Task) results.push(serializeTask(node.object));
    return null;
  });
  return results;
}

export function readPerspectiveRules(perspective: Perspective.Custom): PerspectiveRules {
  const definition = {
    archivedFilterRules: perspective.archivedFilterRules,
    archivedTopLevelFilterAggregation: perspective.archivedTopLevelFilterAggregation,
  };
  if (
    !Array.isArray(definition.archivedFilterRules) ||
    ![null, 'all', 'any', 'none'].includes(definition.archivedTopLevelFilterAggregation)
  ) {
    throw new Error('OmniFocus returned an unsupported perspective rules archive');
  }
  return JSON.parse(JSON.stringify(definition));
}

/** Serializes a JSON value with sorted object keys, so key order cannot fail a comparison. */
export function canonicalRules(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRules).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalRules(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function getPerspectiveRules(args: { idOrName: string }) {
  const perspective = findCustomPerspective(args.idOrName);
  return {
    id: perspective.identifier,
    name: perspective.name,
    definition: readPerspectiveRules(perspective),
  };
}

export function updatePerspectiveRules(args: { idOrName: string; definition: PerspectiveRules }) {
  const perspective = findCustomPerspective(args.idOrName);
  const original = readPerspectiveRules(perspective);
  const definition = args.definition;
  try {
    perspective.archivedFilterRules = definition.archivedFilterRules;
    perspective.archivedTopLevelFilterAggregation = definition.archivedTopLevelFilterAggregation;
    const actual = readPerspectiveRules(perspective);
    if (canonicalRules(actual) !== canonicalRules(definition)) {
      fail('verification_failed', 'OmniFocus did not retain the requested perspective rules');
    }
    return { id: perspective.identifier, name: perspective.name, definition: actual };
  } catch (error) {
    const failures: string[] = [];
    const holds = (key: 'archivedFilterRules' | 'archivedTopLevelFilterAggregation') => {
      try {
        return canonicalRules(perspective[key]) === canonicalRules(original[key]);
      } catch {
        return false;
      }
    };
    try {
      if (!holds('archivedFilterRules')) {
        perspective.archivedFilterRules = original.archivedFilterRules;
      }
    } catch (restoreError) {
      failures.push(`archivedFilterRules: ${messageOf(restoreError)}`);
    }
    try {
      if (!holds('archivedTopLevelFilterAggregation')) {
        perspective.archivedTopLevelFilterAggregation = original.archivedTopLevelFilterAggregation;
      }
    } catch (restoreError) {
      failures.push(`archivedTopLevelFilterAggregation: ${messageOf(restoreError)}`);
    }
    try {
      if (canonicalRules(readPerspectiveRules(perspective)) !== canonicalRules(original)) {
        failures.push('restored definition differs from original');
      }
    } catch (verifyError) {
      failures.push(messageOf(verifyError));
    }
    if (failures.length) {
      fail(
        'partial_write',
        `${messageOf(error)}; perspective rules rollback failed: ${failures.join('; ')}`
      );
    }
    throw unchanged(error);
  }
}

// Statistics

/** The five items with the highest count, highest first. */
export function topFive<T>(items: T[], count: (item: T) => number): T[] {
  return items.sort((a, b) => count(b) - count(a)).slice(0, 5);
}

export function average(total: number, count: number): number {
  return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
}

export function getTaskStats() {
  const allTasks = flattenedTasks;
  const now = new Date();
  const activeTasks = allTasks.filter((task) => !task.completed && task.effectiveActive);
  const completedTasks = allTasks.filter((task) => task.completed);
  const withEstimates = allTasks.filter((task) => (task.estimatedMinutes ?? 0) > 0);
  const totalEstimated = withEstimates.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  const counted = allTasks.filter((task) => task.effectiveActive || task.completed);

  const projectCounts: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  for (const task of counted) {
    const projectName = task.containingProject ? task.containingProject.name : 'Inbox';
    projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;
    for (const tag of task.tags) tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
  }
  const ranked = (counts: Record<string, number>) =>
    topFive(
      Object.entries(counts).map(([name, taskCount]) => ({ name, taskCount })),
      (entry) => entry.taskCount
    );

  return {
    totalTasks: allTasks.length,
    activeTasks: activeTasks.length,
    completedTasks: completedTasks.length,
    flaggedTasks: activeTasks.filter((task) => task.flagged).length,
    overdueActiveTasks: activeTasks.filter((task) => task.dueDate && task.dueDate < now).length,
    avgEstimatedMinutes: withEstimates.length
      ? Math.round(totalEstimated / withEstimates.length)
      : null,
    tasksWithEstimates: withEstimates.length,
    completionRate: counted.length ? Math.round((completedTasks.length / counted.length) * 100) : 0,
    tasksByProject: ranked(projectCounts),
    tasksByTag: ranked(tagCounts),
  };
}

export function getProjectStats() {
  const allProjects = flattenedProjects;
  const remaining = allProjects.filter(projectIsRemaining);
  const sized = remaining.map((project) => {
    const tasks = project.flattenedTasks;
    return {
      name: project.name,
      taskCount: tasks.length,
      remainingCount: tasks.filter((task) => !task.completed).length,
    };
  });
  const totalTasks = sized.reduce((sum, project) => sum + project.taskCount, 0);
  const totalRemaining = sized.reduce((sum, project) => sum + project.remainingCount, 0);
  const completionRates = sized
    .filter((project) => project.taskCount > 0)
    .map((project) => ((project.taskCount - project.remainingCount) / project.taskCount) * 100);

  return {
    totalProjects: allProjects.length,
    activeProjects: remaining.filter((project) => project.status === Project.Status.Active).length,
    onHoldProjects: remaining.filter((project) => project.status === Project.Status.OnHold).length,
    droppedProjects: allProjects.filter((project) => project.status === Project.Status.Dropped)
      .length,
    doneProjects: allProjects.filter((project) => project.status === Project.Status.Done).length,
    sequentialProjects: remaining.filter((project) => project.sequential).length,
    parallelProjects: remaining.filter((project) => !project.sequential).length,
    avgTasksPerProject: average(totalTasks, remaining.length),
    avgRemainingPerProject: average(totalRemaining, remaining.length),
    avgCompletionRate: completionRates.length
      ? Math.round(completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length)
      : 0,
    projectsWithMostTasks: topFive(
      sized.map((project) => ({ name: project.name, taskCount: project.taskCount })),
      (project) => project.taskCount
    ),
    projectsWithMostRemaining: topFive(
      sized
        .filter((project) => project.remainingCount > 0)
        .map((project) => ({ name: project.name, remainingCount: project.remainingCount })),
      (project) => project.remainingCount
    ),
  };
}

export function getTagStats() {
  const allTags = flattenedTags.map((tag) => serializeTag(tag, false));
  const withTasks = allTags.filter((tag) => tag.taskCount > 0);
  const totalTasks = withTasks.reduce((sum, tag) => sum + tag.taskCount, 0);
  const counts = (list: typeof allTags) =>
    list.map((tag) => ({ name: tag.name, taskCount: tag.taskCount }));
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return {
    totalTags: allTags.length,
    activeTags: allTags.filter((tag) => tag.active).length,
    tagsWithTasks: withTasks.length,
    unusedTags: allTags.length - withTasks.length,
    avgTasksPerTag: average(totalTasks, withTasks.length),
    mostUsedTags: topFive(counts(allTags), (tag) => tag.taskCount),
    leastUsedTags: counts(withTasks)
      .sort((a, b) => a.taskCount - b.taskCount)
      .slice(0, 5),
    staleTags: allTags
      .filter((tag) => tag.lastActivity && now - new Date(tag.lastActivity).getTime() > 30 * day)
      .map((tag) => ({
        name: tag.name,
        daysSinceActivity: Math.floor((now - new Date(tag.lastActivity as string).getTime()) / day),
      }))
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity),
  };
}
