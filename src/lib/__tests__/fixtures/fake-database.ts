/**
 * An in-memory OmniFocus database that follows the object model in
 * omniautomation.d.ts: a project owns a root task, top-level project tasks
 * have that root task as `parent`, top-level inbox tasks have no parent, and
 * every collection read returns a new array. `context` holds the globals an
 * Omni Automation script sees.
 */

type Relation = 'beginning' | 'ending' | 'before' | 'after';
export interface Location {
  relation: Relation;
  of: unknown;
}

export interface FakePerspective {
  identifier: string;
  name: string;
  archivedFilterRules: unknown;
  archivedTopLevelFilterAggregation: string | null;
}

const ROOT = Symbol('root');

/**
 * Rewrites a note on the way in, as live OmniFocus was observed to: CR, CRLF,
 * and Unicode line separators become line feeds, byte order marks and control
 * characters are dropped, and whitespace at either end is trimmed. Names are
 * kept as written.
 */
function storedNote(note: string): string {
  const lineBreak = (code: number) => code === 0x2028 || code === 0x2029 || code === 13;
  const dropped = (code: number) => code === 0xfeff || (code < 32 && code !== 9 && code !== 10);
  return Array.from(note.split('\r\n').join('\n'))
    .map((character) => (lineBreak(character.charCodeAt(0)) ? '\n' : character))
    .filter((character) => !dropped(character.charCodeAt(0)))
    .join('')
    .trim();
}
/** Passed as a task's position to create it outside any container, as a project's root task is. */
export const DETACHED = Symbol('detached');

/** A read of a property the fake does not model throws, so no test passes on `undefined`. */
function strict<T extends object>(object: T): T {
  return new Proxy(object, {
    get(target, key, receiver) {
      if (typeof key === 'string' && !(key in target) && key !== 'then' && key !== 'toJSON') {
        throw new Error(`The fake ${target.constructor.name} has no property "${key}"`);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

function at(relation: Relation, of: unknown): Location {
  return { relation, of };
}

/** Removes an item from its current list, then inserts it where the location says. */
function place<Item, Parent>(
  item: Item,
  location: Location,
  model: {
    listOf(parent: Parent | null): Item[];
    parentOf(item: Item): Parent | null;
    setParent(item: Item, parent: Parent | null): void;
    attached(item: Item): boolean;
  }
): void {
  if (model.attached(item)) {
    const current = model.listOf(model.parentOf(item));
    current.splice(current.indexOf(item), 1);
  }
  let parent: Parent | null;
  let index: number;
  if (location.relation === 'before' || location.relation === 'after') {
    const anchor = location.of as Item;
    parent = model.parentOf(anchor);
    index = model.listOf(parent).indexOf(anchor) + (location.relation === 'after' ? 1 : 0);
  } else {
    parent = location.of === ROOT ? null : (location.of as Parent);
    index = location.relation === 'beginning' ? 0 : model.listOf(parent).length;
  }
  model.listOf(parent).splice(index, 0, item);
  model.setParent(item, parent);
}

export function fakeDatabase() {
  let counter = 0;
  const inboxTasks: FakeTask[] = [];
  const rootSections: Section[] = [];
  const rootTags: FakeTag[] = [];
  const perspectives: FakePerspective[] = [];

  class Base {
    readonly id = { primaryKey: `id-${++counter}`, objectClass: null };
    added: Date | null = null;
    modified: Date | null = null;
  }

  class FakeTag extends Base {
    static Status = { Active: 'tag-active', OnHold: 'tag-on-hold', Dropped: 'tag-dropped' };
    static byIdentifier = (id: string) => allTags().find((tag) => tag.id.primaryKey === id) ?? null;
    status = FakeTag.Status.Active;
    allowsNextAction = true;
    _parent: FakeTag | null = null;
    _children: FakeTag[] = [];
    _attached = false;

    constructor(
      public name: string,
      position?: FakeTag | Location | null
    ) {
      super();
      const self = strict(this);
      moveTags([self], position ?? at('ending', ROOT));
      return self;
    }
    get parent() {
      return this._parent;
    }
    get children() {
      return [...this._children];
    }
    get active() {
      return this.status === FakeTag.Status.Active;
    }
    get tasks() {
      return allTasks().filter((task) => task._tags.includes(this));
    }
    get remainingTasks() {
      return this.tasks.filter((task) => !task.completed);
    }
    get beginning() {
      return at('beginning', this);
    }
    get ending() {
      return at('ending', this);
    }
    get before() {
      return at('before', this);
    }
    get after() {
      return at('after', this);
    }
  }

  class FakeTask extends Base {
    static Status = {
      Available: 'task-available',
      Blocked: 'task-blocked',
      Completed: 'task-completed',
      Dropped: 'task-dropped',
      DueSoon: 'task-due-soon',
      Next: 'task-next',
      Overdue: 'task-overdue',
    };
    static byIdentifier = (id: string) =>
      allTasks().find((task) => task.id.primaryKey === id) ?? null;
    _note = '';
    flagged = false;
    estimatedMinutes: number | null = null;
    deferDate: Date | null = null;
    dueDate: Date | null = null;
    plannedDate: Date | null = null;
    completed = false;
    completionDate: Date | null = null;
    dropDate: Date | null = null;
    repetitionRule: object | null = null;
    assignedContainer: unknown = null;
    /** Set by a test to stand in for a status OmniFocus derives, such as Overdue or Blocked. */
    statusOverride: string | null = null;
    _parent: FakeTask | null = null;
    _children: FakeTask[] = [];
    _project: FakeProject | null = null;
    _tags: FakeTag[] = [];
    _attached = false;

    constructor(
      public name: string,
      position?: FakeProject | FakeTask | Location | typeof DETACHED | null
    ) {
      super();
      const self = strict(this);
      if (position !== DETACHED) moveTasks([self], position ?? at('ending', ROOT));
      return self;
    }
    get note() {
      return this._note;
    }
    set note(value: string) {
      this._note = storedNote(value);
    }
    get parent() {
      return this._parent;
    }
    get tasks() {
      return [...this._children];
    }
    get children() {
      return [...this._children];
    }
    get flattenedTasks(): FakeTask[] {
      return this._children.flatMap((child) => [child, ...child.flattenedTasks]);
    }
    get containingProject(): FakeProject | null {
      let top = this as FakeTask;
      while (top._parent) top = top._parent;
      return top._project;
    }
    get inInbox() {
      return !this._parent && !this._project;
    }
    get tags() {
      return [...this._tags];
    }
    clearTags() {
      this._tags = [];
    }
    addTag(tag: FakeTag) {
      if (!this._tags.includes(tag)) this._tags.push(tag);
    }
    get active() {
      return !this.dropDate;
    }
    set active(value: boolean) {
      this.dropDate = value ? null : new Date();
    }
    get effectiveActive(): boolean {
      if (this.dropDate) return false;
      if (this._parent) return this._parent.effectiveActive;
      return this._project ? this._project.isRemaining() : true;
    }
    get effectiveCompletionDate() {
      return this.completionDate;
    }
    get taskStatus() {
      if (this.statusOverride) return this.statusOverride;
      if (this.completed) return FakeTask.Status.Completed;
      return this.dropDate ? FakeTask.Status.Dropped : FakeTask.Status.Available;
    }
    markComplete(date: Date | null) {
      this.completed = true;
      this.completionDate = date ?? new Date();
      return this;
    }
    markIncomplete() {
      this.completed = false;
      this.completionDate = null;
    }
    drop(_allOccurrences: boolean, date: Date | null) {
      this.dropDate = date ?? new Date();
    }
    get beginning() {
      return at('beginning', this);
    }
    get ending() {
      return at('ending', this);
    }
    get before() {
      return at('before', this);
    }
    get after() {
      return at('after', this);
    }
  }

  class FakeProject {
    static Status = {
      Active: 'project-active',
      OnHold: 'project-on-hold',
      Dropped: 'project-dropped',
      Done: 'project-done',
    };
    static byIdentifier = (id: string) =>
      allProjects().find((project) => project.id.primaryKey === id) ?? null;
    readonly task: FakeTask;
    status = FakeProject.Status.Active;
    sequential = false;
    containsSingletonActions = false;
    _folder: FakeFolder | null = null;
    _attached = false;

    constructor(name: string, position?: FakeFolder | Location | null) {
      this.task = new FakeTask(name, DETACHED);
      const self = strict(this);
      this.task._project = self;
      moveSections([self], position ?? at('ending', ROOT));
      return self;
    }
    get id() {
      return this.task.id;
    }
    get name() {
      return this.task.name;
    }
    set name(value: string) {
      this.task.name = value;
    }
    get note() {
      return this.task.note;
    }
    set note(value: string) {
      this.task.note = value;
    }
    get tags() {
      return this.task.tags;
    }
    clearTags() {
      this.task.clearTags();
    }
    addTag(...args: [tag: FakeTag]) {
      // Project.addTag declares one parameter; Task.addTag declares a second for location.
      if (args.length !== 1) throw new Error('Project.addTag takes exactly one argument');
      this.task.addTag(args[0]);
    }
    get parentFolder() {
      return this._folder;
    }
    get tasks() {
      return this.task.tasks;
    }
    get flattenedTasks() {
      return this.task.flattenedTasks;
    }
    get completed() {
      return this.status === FakeProject.Status.Done;
    }
    isRemaining(): boolean {
      const finished =
        this.status === FakeProject.Status.Dropped || this.status === FakeProject.Status.Done;
      return !finished && (!this._folder || this._folder.effectiveActive);
    }
    get beginning() {
      return at('beginning', this.task);
    }
    get ending() {
      return at('ending', this.task);
    }
    get before() {
      return at('before', this);
    }
    get after() {
      return at('after', this);
    }
  }

  class FakeFolder extends Base {
    static Status = { Active: 'folder-active', Dropped: 'folder-dropped' };
    static byIdentifier = (id: string) =>
      allFolders().find((folder) => folder.id.primaryKey === id) ?? null;
    status = FakeFolder.Status.Active;
    _folder: FakeFolder | null = null;
    _sections: Section[] = [];
    _attached = false;

    constructor(
      public name: string,
      position?: FakeFolder | Location | null
    ) {
      super();
      const self = strict(this);
      moveSections([self], position ?? at('ending', ROOT));
      return self;
    }
    get parent() {
      return this._folder;
    }
    get sections() {
      return [...this._sections];
    }
    get folders() {
      return this._sections.filter((section) => section instanceof FakeFolder);
    }
    get projects() {
      return this._sections.filter((section) => section instanceof FakeProject);
    }
    get active() {
      return this.status === FakeFolder.Status.Active;
    }
    get effectiveActive(): boolean {
      return this.active && (!this._folder || this._folder.effectiveActive);
    }
    get beginning() {
      return at('beginning', this);
    }
    get ending() {
      return at('ending', this);
    }
    get before() {
      return at('before', this);
    }
    get after() {
      return at('after', this);
    }
  }

  type Section = FakeProject | FakeFolder;

  const walkSections = (sections: Section[]): Section[] =>
    sections.flatMap((section) =>
      section instanceof FakeFolder ? [section, ...walkSections(section._sections)] : [section]
    );
  const allProjects = () =>
    walkSections(rootSections).filter((section) => section instanceof FakeProject);
  const allFolders = () =>
    walkSections(rootSections).filter((section) => section instanceof FakeFolder);
  const allTags = (list: FakeTag[] = rootTags): FakeTag[] =>
    list.flatMap((tag) => [tag, ...allTags(tag._children)]);
  const allTasks = (): FakeTask[] => [
    ...allProjects().flatMap((project) => [project.task, ...project.task.flattenedTasks]),
    ...inboxTasks.flatMap((task) => [task, ...task.flattenedTasks]),
  ];

  function moveTasks(tasks: FakeTask[], position: FakeProject | FakeTask | Location) {
    const location =
      position instanceof FakeProject
        ? position.ending
        : position instanceof FakeTask
          ? position.ending
          : position;
    for (const task of tasks) {
      place<FakeTask, FakeTask>(task, location, {
        listOf: (parent) => (parent ? parent._children : inboxTasks),
        parentOf: (item) => item._parent,
        setParent: (item, parent) => {
          item._parent = parent;
          item._attached = true;
        },
        attached: (item) => item._attached,
      });
    }
  }

  function moveSections(sections: Section[], position: FakeFolder | Location) {
    const location = position instanceof FakeFolder ? position.ending : position;
    for (const section of sections) {
      place<Section, FakeFolder>(section, location, {
        listOf: (parent) => (parent ? parent._sections : rootSections),
        parentOf: (item) => item._folder,
        setParent: (item, parent) => {
          item._folder = parent;
          item._attached = true;
        },
        attached: (item) => item._attached,
      });
    }
  }

  function moveTags(tags: FakeTag[], position: FakeTag | Location) {
    const location = position instanceof FakeTag ? position.ending : position;
    for (const tag of tags) {
      place<FakeTag, FakeTag>(tag, location, {
        listOf: (parent) => (parent ? parent._children : rootTags),
        parentOf: (item) => item._parent,
        setParent: (item, parent) => {
          item._parent = parent;
          item._attached = true;
        },
        attached: (item) => item._attached,
      });
    }
  }

  function deleteObject(object: FakeTask | FakeProject | FakeFolder | FakeTag) {
    const remove = <T>(list: T[], item: T) => list.splice(list.indexOf(item), 1);
    if (object instanceof FakeTask) {
      remove(object._parent ? object._parent._children : inboxTasks, object);
    } else if (object instanceof FakeTag) {
      remove(object._parent ? object._parent._children : rootTags, object);
      for (const task of allTasks()) task._tags = task._tags.filter((tag) => tag !== object);
    } else {
      remove(object._folder ? object._folder._sections : rootSections, object);
    }
  }

  const frontWindow = {
    perspective: null as unknown,
    /** The tasks the window shows once a perspective is selected. */
    visibleTasks: [] as FakeTask[],
    get content() {
      const tasks = this.visibleTasks;
      return {
        rootNode: {
          apply(visit: (node: { object: unknown }) => unknown) {
            for (const task of tasks) visit({ object: task });
          },
        },
      };
    },
  };
  const windows = [frontWindow];
  const builtInNames = [
    'Flagged',
    'Forecast',
    'Inbox',
    'Nearby',
    'Projects',
    'Review',
    'Search',
    'Tags',
  ] as const;
  const builtIn = Object.fromEntries(builtInNames.map((name) => [name, { name }])) as Record<
    (typeof builtInNames)[number],
    { name: string }
  >;

  const context = {
    Task: FakeTask,
    Project: FakeProject,
    Tag: FakeTag,
    Folder: FakeFolder,
    Perspective: {
      Custom: {
        get all() {
          return [...perspectives];
        },
        byIdentifier: (id: string) => perspectives.find((p) => p.identifier === id) ?? null,
        byName: (name: string) => perspectives.find((p) => p.name === name) ?? null,
      },
      BuiltIn: { ...builtIn, all: Object.values(builtIn) },
    },
    get flattenedTasks() {
      return allTasks();
    },
    get flattenedProjects() {
      return allProjects();
    },
    get flattenedFolders() {
      return allFolders();
    },
    get flattenedTags() {
      return allTags();
    },
    get folders() {
      return rootSections.filter((section) => section instanceof FakeFolder);
    },
    get tags() {
      return Object.assign([...rootTags], {
        beginning: at('beginning', ROOT),
        ending: at('ending', ROOT),
      });
    },
    get inbox() {
      return Object.assign([...inboxTasks], {
        beginning: at('beginning', ROOT),
        ending: at('ending', ROOT),
        apply(visit: (task: FakeTask) => unknown) {
          const walk = (task: FakeTask) => {
            visit(task);
            task._children.forEach(walk);
          };
          inboxTasks.forEach(walk);
        },
      });
    },
    get library() {
      return Object.assign([...rootSections], {
        beginning: at('beginning', ROOT),
        ending: at('ending', ROOT),
      });
    },
    get document() {
      return { windows: [...windows] };
    },
    moveTasks,
    moveSections,
    moveTags,
    deleteObject,
  };

  return {
    context,
    Task: FakeTask,
    Project: FakeProject,
    Tag: FakeTag,
    Folder: FakeFolder,
    perspectives,
    windows,
    frontWindow,
  };
}
