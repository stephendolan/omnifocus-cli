import { describe, expect, it, mock } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { OmniFocus } from '../omnifocus.js';
import { createMcpServer } from '../../mcp/server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

function database() {
  const projects: any[] = [],
    folders: any[] = [],
    tags: any[] = [],
    tasks: any[] = [];
  let next = 0;
  const library: any = { ending: { container: null } };
  const inbox: any = [];
  inbox.ending = { container: inbox };
  class Base {
    id = { primaryKey: String(++next) };
    note = '';
    tags: any[] = [];
    clearTags() {
      this.tags = [];
    }
    addTag(tag: any) {
      this.tags.push(tag);
    }
    constructor(public name: string) {}
  }
  class Project extends Base {
    static Status = { Active: 'active', OnHold: 'on hold', Dropped: 'dropped', Done: 'done' };
    status = 'active';
    sequential = false;
    containsSingletonActions = false;
    parentFolder: any = null;
    tasks: any[] = [];
    get remainingTasks() {
      return this.tasks.filter((t) => !t.completed);
    }
    get flattenedTasks() {
      return this.tasks;
    }
    get ending() {
      return { container: this };
    }
    constructor(name: string, folder?: any) {
      super(name);
      this.parentFolder = folder || null;
      projects.push(this);
    }
  }
  class Folder extends Base {
    static Status = { Active: 'active', Dropped: 'dropped' };
    status = 'active';
    effectiveActive = true;
    parent = null;
    folders: any[] = [];
    get projects() {
      return projects.filter((p) => p.parentFolder === this);
    }
    get ending() {
      return { container: this };
    }
    constructor(name: string) {
      super(name);
      folders.push(this);
    }
  }
  class Tag extends Base {
    static Status = { Active: 'active', OnHold: 'on hold', Dropped: 'dropped' };
    status = 'active';
    parent: any = null;
    tasks: any[] = [];
    allowsNextAction = true;
    get children() {
      return tags.filter((t) => t.parent === this);
    }
    get remainingTasks() {
      return this.tasks.filter((t) => !t.completed);
    }
    get flattenedTasks() {
      return this.tasks;
    }
    get ending() {
      return { container: this };
    }
    constructor(name: string, parent?: any) {
      super(name);
      this.parent = parent?.container === null ? null : parent || null;
      tags.push(this);
    }
  }
  class Task extends Base {
    completed = false;
    dropDate = null;
    flagged = false;
    effectiveActive = true;
    deferDate = null;
    dueDate = null;
    plannedDate = null;
    estimatedMinutes = null;
    parent = null;
    children: any[] = [];
    get containingProject() {
      return Array.isArray(this.assignedContainer) ? null : this.assignedContainer;
    }
    get before() {
      return { anchor: this, after: false };
    }
    get after() {
      return { anchor: this, after: true };
    }
    constructor(
      name: string,
      public assignedContainer: any = inbox
    ) {
      super(name);
      tasks.push(this);
      (assignedContainer.tasks || assignedContainer).push(this);
    }
  }
  const moveTasks = (items: any[], position: any) => {
    for (const task of items) {
      const old = task.assignedContainer.tasks || task.assignedContainer;
      old.splice(old.indexOf(task), 1);
      const container = position.anchor ? position.anchor.assignedContainer : position.container;
      const siblings = container.tasks || container;
      siblings.splice(
        position.anchor
          ? siblings.indexOf(position.anchor) + Number(position.after)
          : siblings.length,
        0,
        task
      );
      task.assignedContainer = container;
    }
  };
  const rootTags: any = tags;
  rootTags.ending = { container: null };
  const context = {
    Project,
    Folder,
    Tag,
    Task,
    library,
    inbox,
    folders,
    tags: rootTags,
    flattenedProjects: projects,
    flattenedSections: projects,
    flattenedFolders: folders,
    flattenedTags: tags,
    get flattenedTasks() {
      return projects.flatMap((p) => p.tasks).concat(inbox);
    },
    moveTasks,
    moveSections: (items: any[], position: any) =>
      items.forEach((p) => {
        p.parentFolder = position.container;
      }),
    moveTags: (items: any[], position: any) =>
      items.forEach((t) => {
        t.parent = position.container;
      }),
  };
  const of = new OmniFocus();
  of['executeJXA'] = mock(async (script: string) =>
    runInNewContext(script, {
      ObjC: { import() {}, bindFunction() {} },
      $: {
        NSAppleEventDescriptor: { descriptorWithBundleIdentifier: () => ({ aeDesc: {} }) },
        AEDeterminePermissionToAutomateTarget: () => 0,
      },
      Application: () => ({ evaluateJavascript: (code: string) => runInNewContext(code, context) }),
    })
  );
  return { of, Project, Folder, Tag, Task, projects, moveTasks, context };
}

describe('hierarchy mutations', () => {
  it('creates and converts all project types without replacing the project', async () => {
    const { of } = database();
    const p = await of.createProject({ name: 'List', singleActionList: true });
    expect(p).toMatchObject({ type: 'single-action', singleActionList: true, sequential: false });
    for (const type of ['parallel', 'sequential', 'single-action'] as const) {
      expect(await of.updateProject(p.id, { type })).toMatchObject({ id: p.id, type });
      expect(await of.getProject(p.id)).toMatchObject({ id: p.id, type });
    }
    await expect(
      of.updateProject(p.id, { type: 'single-action', sequential: true })
    ).rejects.toThrow('Conflicting');
    expect((await of.getProject(p.id)).type).toBe('single-action');
  });
  it('moves by folder ID/name, clears to root, and exposes done separately', async () => {
    const { of, Folder } = database();
    const f = new Folder('Folder');
    const p = await of.createProject({ name: 'Project' });
    for (const folder of [f.id.primaryKey, 'Folder', null, '']) {
      expect(await of.updateProject(p.id, { folder })).toMatchObject({
        folder: folder ? 'Folder' : null,
        folderId: folder ? f.id.primaryKey : null,
      });
    }
    expect(await of.updateProject(p.id, { completed: true })).toMatchObject({ status: 'done' });
    expect(await of.listProjects({ status: 'done' })).toMatchObject([{ id: p.id, status: 'done' }]);
    expect(await of.updateProject(p.id, { status: 'dropped' })).toMatchObject({
      status: 'dropped',
    });
  });
  it('reparents tags while preserving identity and rejects cycles', async () => {
    const { of } = database();
    const parent = await of.createTag({ name: 'Parent' });
    const child = await of.createTag({ name: 'Child' });
    expect(await of.updateTag(child.id, { parent: parent.id })).toMatchObject({
      id: child.id,
      parentId: parent.id,
    });
    expect((await of.getTag(parent.id)).children).toEqual(['Child']);
    await expect(of.updateTag(parent.id, { parent: child.id })).rejects.toThrow('descendant');
    expect(await of.updateTag(child.id, { parent: null })).toMatchObject({ parent: null });
  });
  it('orders original tasks and rejects cross-container or conflicting moves', async () => {
    const { of, Project, Task } = database();
    const p = new Project('Sequence');
    p.sequential = true;
    const c = new Task('C', p),
      a = new Task('A', p),
      b = new Task('B', p);
    await of.updateTask(a.id.primaryKey, { before: b.id.primaryKey });
    await of.updateTask(c.id.primaryKey, { after: b.id.primaryKey });
    expect((await of.listTasks({ project: p.id.primaryKey })).map((t) => t.id)).toEqual([
      a.id.primaryKey,
      b.id.primaryKey,
      c.id.primaryKey,
    ]);
    await of.updateTask(c.id.primaryKey, { before: a.id.primaryKey });
    expect(p.tasks.map((t) => t.name)).toEqual(['C', 'A', 'B']);
    const outsider = new Task('Other', new Project('Other'));
    await expect(
      of.updateTask(c.id.primaryKey, { before: outsider.id.primaryKey })
    ).rejects.toThrow('sibling');
    await expect(
      of.updateTask(c.id.primaryKey, { before: a.id.primaryKey, completed: true })
    ).rejects.toThrow('Ordering');
  });
  it('resolves tags before clearing existing assignments or applying a rename', async () => {
    const { of, Project, Tag } = database();
    const p = new Project('Original'),
      t = new Tag('Keep');
    p.tags = [t];
    await expect(
      of.updateProject(p.id.primaryKey, { name: 'Changed', tags: ['Missing'] })
    ).rejects.toThrow('not found');
    expect(await of.getProject(p.id.primaryKey)).toMatchObject({
      name: 'Original',
      tags: ['Keep'],
    });
  });
  it('restores both underlying type properties after a setter mutates and throws', async () => {
    const { of, Project } = database();
    const p = new Project('Original');
    p.containsSingletonActions = true;
    p.sequential = true;
    let singleton = true,
      fail = true;
    Object.defineProperty(p, 'containsSingletonActions', {
      get: () => singleton,
      set: (value) => {
        singleton = value;
        if (fail) {
          fail = false;
          throw new Error('Setter failed');
        }
      },
    });
    await expect(of.updateProject(p.id.primaryKey, { type: 'parallel' })).rejects.toThrow(
      'Setter failed'
    );
    expect(p.containsSingletonActions).toBe(true);
    expect(p.sequential).toBe(true);
  });
  it('moves an inbox task whose assigned container is a distinct inbox wrapper', async () => {
    const { of, Project, Task, context } = database();
    const p = new Project('Destination');
    const task = new Task('Inbox task');
    task.assignedContainer = new Proxy(context.inbox, {});
    expect(await of.updateTask(task.id.primaryKey, { project: p.id.primaryKey })).toMatchObject({
      projectId: p.id.primaryKey,
    });
    expect((await of.listTasks({ project: p.id.primaryKey })).map((t) => t.id)).toEqual([
      task.id.primaryKey,
    ]);
  });
  it('rejects repeating completion before changing fields or creating occurrences', async () => {
    const { of, Project, Task } = database();
    const p = new Project('Recurring');
    const task = new Task('Keep', p);
    Object.assign(task, {
      repetitionRule: {},
      markComplete: () => {
        new Task('Occurrence', p);
      },
    });
    await expect(
      of.updateTask(task.id.primaryKey, { name: 'Wrong', completed: true })
    ).rejects.toThrow('Repeating task');
    expect(p.tasks.map((t) => t.name)).toEqual(['Keep']);
  });
  it('reports an ignored reorder and preserves the original order', async () => {
    const { of, Project, Task, context } = database();
    const p = new Project('Sequence');
    const a = new Task('A', p),
      b = new Task('B', p);
    context.moveTasks = () => {};
    await expect(of.updateTask(a.id.primaryKey, { after: b.id.primaryKey })).rejects.toThrow(
      'verification'
    );
    expect(p.tasks.map((t) => t.id.primaryKey)).toEqual([a.id.primaryKey, b.id.primaryKey]);
  });
  it('rejects unsupported arguments through MCP without applying valid siblings', async () => {
    const { of } = database();
    const p = await of.createProject({ name: 'Original' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer({ omniFocus: of });
    const client = new Client({ name: 'test', version: '1' });
    await server.connect(st);
    await client.connect(ct);
    try {
      const result = await client.callTool({
        name: 'update_project',
        arguments: { idOrName: p.id, name: 'Wrong', bogus: true },
      });
      expect(result.isError).toBe(true);
      expect((await of.getProject(p.id)).name).toBe('Original');
      const created = await client.callTool({
        name: 'create_project',
        arguments: { name: 'List', singleActionList: true },
      });
      expect(created.isError).not.toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
