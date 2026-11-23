import { describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../mcp/server.js';
import { OmniFocusError } from '../errors.js';
import { fakeOmniFocus } from './fixtures/fake-omnifocus.js';

const idOf = (object: { id: { primaryKey: string } }) => object.id.primaryKey;
const namesOf = (list: { name: string }[]) => list.map((item) => item.name);

async function failure(promise: Promise<unknown>): Promise<OmniFocusError> {
  const error = await promise.then(
    () => new Error('Expected a rejection'),
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(OmniFocusError);
  return error as OmniFocusError;
}

describe('hierarchy mutations', () => {
  it('creates and converts all project types without replacing the project', async () => {
    const { of } = fakeOmniFocus();
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
    const { of, Folder } = fakeOmniFocus();
    const f = new Folder('Folder');
    const p = await of.createProject({ name: 'Project' });
    for (const folder of [idOf(f), 'Folder', null, '']) {
      expect(await of.updateProject(p.id, { folder })).toMatchObject({
        folder: folder ? 'Folder' : null,
        folderId: folder ? idOf(f) : null,
      });
    }
    expect(await of.updateProject(p.id, { completed: true })).toMatchObject({ status: 'done' });
    expect(await of.listProjects({ status: 'done' })).toMatchObject([{ id: p.id, status: 'done' }]);
    expect(await of.updateProject(p.id, { status: 'dropped' })).toMatchObject({
      status: 'dropped',
    });
  });

  it('creates a project inside a folder and leaves an unchanged folder alone', async () => {
    const { of, Folder, Project } = fakeOmniFocus();
    const f = new Folder('Folder');
    const first = new Project('First', f);
    const created = await of.createProject({ name: 'Second', folder: 'Folder' });
    new Project('Third', f);
    expect(created).toMatchObject({ folder: 'Folder', folderId: idOf(f) });
    await of.updateProject(idOf(first), { folder: 'Folder', note: 'kept in place' });
    expect(namesOf(f.projects)).toEqual(['First', 'Second', 'Third']);
  });

  it('creates a tag under a parent that has the same name', async () => {
    const { of, Tag } = fakeOmniFocus();
    const parent = new Tag('Home');
    const child = await of.createTag({ name: 'Home', parent: 'Home' });
    expect(child).toMatchObject({ name: 'Home', parentId: idOf(parent) });
    expect(parent.children.map(idOf)).toEqual([child.id]);
  });

  it('reparents tags while preserving identity and rejects cycles', async () => {
    const { of } = fakeOmniFocus();
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

  it('accepts agreeing parent and parentId and rejects conflicting ones', async () => {
    const { of, Tag } = fakeOmniFocus();
    const a = new Tag('A');
    const b = new Tag('B');
    const child = new Tag('Child');
    expect(await of.updateTag(idOf(child), { parent: 'A', parentId: idOf(a) })).toMatchObject({
      parentId: idOf(a),
    });
    const error = await failure(of.updateTag(idOf(child), { parent: 'A', parentId: idOf(b) }));
    expect(error).toMatchObject({ code: 'invalid', statusCode: 400 });
    expect(child.parent).toBe(a);
  });

  it('orders original tasks and rejects cross-container or conflicting moves', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const p = new Project('Sequence');
    p.sequential = true;
    const c = new Task('C', p),
      a = new Task('A', p),
      b = new Task('B', p);
    await of.updateTask(idOf(a), { before: idOf(b) });
    await of.updateTask(idOf(c), { after: idOf(b) });
    expect((await of.listTasks({ project: idOf(p) })).map((t) => t.id)).toEqual([
      idOf(a),
      idOf(b),
      idOf(c),
    ]);
    await of.updateTask(idOf(c), { before: idOf(a) });
    expect(namesOf(p.tasks)).toEqual(['C', 'A', 'B']);
    const outsider = new Task('Other', new Project('Other'));
    await expect(of.updateTask(idOf(c), { before: idOf(outsider) })).rejects.toThrow('sibling');
    await expect(of.updateTask(idOf(c), { before: idOf(c) })).rejects.toThrow('itself');
    await expect(of.updateTask(idOf(c), { before: 'missing' })).rejects.toThrow(
      'Task not found: missing'
    );
    await expect(of.updateTask(idOf(c), { before: idOf(a), completed: true })).rejects.toThrow(
      'Ordering'
    );
    expect(namesOf(p.tasks)).toEqual(['C', 'A', 'B']);
  });

  it('orders subtasks under a parent task and top-level inbox tasks', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    const group = new Task('Group', new Project('Project'));
    const one = new Task('One', group),
      two = new Task('Two', group);
    await of.updateTask(idOf(two), { before: idOf(one) });
    expect(namesOf(group.tasks)).toEqual(['Two', 'One']);
    expect(await of.getTask(idOf(two))).toMatchObject({ parentTaskId: idOf(group) });

    const first = new Task('First'),
      second = new Task('Second');
    await of.updateTask(idOf(first), { after: idOf(second) });
    expect(namesOf(context.inbox)).toEqual(['Second', 'First']);
    await expect(of.updateTask(idOf(first), { before: idOf(one) })).rejects.toThrow('sibling');
  });

  it('resolves tags before clearing existing assignments or applying a rename', async () => {
    const { of, Project, Tag } = fakeOmniFocus();
    const p = new Project('Original');
    p.addTag(new Tag('Keep'));
    const error = await failure(of.updateProject(idOf(p), { name: 'Changed', tags: ['Missing'] }));
    expect(error).toMatchObject({ code: 'not_found', statusCode: 404 });
    expect(await of.getProject(idOf(p))).toMatchObject({ name: 'Original', tags: ['Keep'] });
  });

  it('replaces tags on tasks and projects by ID, name, or path', async () => {
    const { of, Project, Tag, Task } = fakeOmniFocus();
    const parent = new Tag('Area');
    const nested = new Tag('Work', parent);
    const plain = new Tag('Home');
    const p = new Project('Project');
    const task = new Task('Task', p);
    task.addTag(plain);
    expect(await of.updateTask(idOf(task), { tags: ['Area/Work', idOf(parent)] })).toMatchObject({
      tags: ['Work', 'Area'],
    });
    expect(await of.updateProject(idOf(p), { tags: ['Home'] })).toMatchObject({ tags: ['Home'] });
    expect(await of.updateTask(idOf(task), { tags: [] })).toMatchObject({ tags: [] });
    expect(nested.tasks).toEqual([]);
  });

  it('restores both underlying type properties after a setter mutates and throws', async () => {
    const { of, Project } = fakeOmniFocus();
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
    await expect(of.updateProject(idOf(p), { type: 'parallel' })).rejects.toThrow('Setter failed');
    expect(p.containsSingletonActions).toBe(true);
    expect(p.sequential).toBe(true);
  });

  it('moves a task between the inbox and a project when every inbox read is a new wrapper', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    expect(context.inbox).not.toBe(context.inbox);
    const p = new Project('Destination');
    const task = new Task('Inbox task');
    task.assignedContainer = context.inbox;
    expect(await of.updateTask(idOf(task), { project: idOf(p) })).toMatchObject({
      projectId: idOf(p),
      parentTaskId: null,
    });
    expect((await of.listTasks({ project: idOf(p) })).map((t) => t.id)).toEqual([idOf(task)]);
    for (const project of [null, '']) {
      await of.updateTask(idOf(task), { project: idOf(p) });
      expect(await of.updateTask(idOf(task), { project })).toMatchObject({
        project: null,
        projectId: null,
      });
      expect(namesOf(context.inbox)).toEqual(['Inbox task']);
    }
  });

  it('rejects repeating completion before changing fields or creating occurrences', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const p = new Project('Recurring');
    const task = new Task('Keep', p);
    Object.assign(task, {
      repetitionRule: {},
      markComplete: () => {
        new Task('Occurrence', p);
      },
    });
    const error = await failure(of.updateTask(idOf(task), { name: 'Wrong', completed: true }));
    expect(error.message).toContain('Repeating task');
    expect(error.code).toBe('invalid');
    expect(namesOf(p.tasks)).toEqual(['Keep']);
  });

  it('reports an ignored reorder and preserves the original order', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    const p = new Project('Sequence');
    const a = new Task('A', p),
      b = new Task('B', p);
    context.moveTasks = () => {};
    const error = await failure(of.updateTask(idOf(a), { after: idOf(b) }));
    expect(error).toMatchObject({
      code: 'verification_failed',
      message: 'Write verification failed: order',
    });
    expect(p.tasks.map(idOf)).toEqual([idOf(a), idOf(b)]);
  });

  it('rejects unsupported arguments through MCP without applying valid siblings', async () => {
    const { of } = fakeOmniFocus();
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

describe('write verification and restoration', () => {
  it('applies every task field and reads each one back', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const task = new Task('Before', new Project('Project'));
    const updated = await of.updateTask(idOf(task), {
      name: 'After',
      note: 'line one\nline "two"',
      flagged: true,
      estimatedMinutes: 25,
      due: '2026-12-01T10:00:00.123Z',
      defer: '2026-11-30',
      planned: '2026-11-29T08:00:00Z',
    });
    expect(updated).toMatchObject({
      name: 'After',
      note: 'line one\nline "two"',
      flagged: true,
      estimatedMinutes: 25,
      due: '2026-12-01T10:00:00.123Z',
      planned: '2026-11-29T08:00:00.000Z',
    });
    expect(await of.updateTask(idOf(task), { due: null, defer: '' })).toMatchObject({
      due: null,
      defer: null,
    });
  });

  it('undoes earlier writes in a task update when a later write fails', async () => {
    const { of, Project, Task, Tag, context } = fakeOmniFocus();
    const home = new Project('Home');
    const task = new Task('Original', home);
    const other = new Task('Other', home);
    task.addTag(new Tag('Kept'));
    new Tag('New');
    task.flagged = true;
    const destination = new Project('Destination');
    const move = context.moveTasks;
    context.moveTasks = () => {
      context.moveTasks = move;
      throw new Error('Move refused');
    };
    const error = await failure(
      of.updateTask(idOf(task), {
        name: 'Renamed',
        flagged: false,
        due: '2026-12-01',
        project: idOf(destination),
        tags: ['New'],
      })
    );
    expect(error.message).toContain('Move refused');
    expect(error.code).toBe('script_error');
    expect(await of.getTask(idOf(task))).toMatchObject({
      name: 'Original',
      flagged: true,
      due: null,
      projectId: idOf(home),
      tags: ['Kept'],
    });
    expect(home.tasks.map(idOf)).toEqual([idOf(task), idOf(other)]);
  });

  it('puts a task back where it was after a move or reorder that really happened', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const home = new Project('Home');
    const [first, second, last] = ['First', 'Second', 'Last'].map((name) => new Task(name, home));
    const destination = new Project('Destination');
    new Task('Resident', destination);
    const refuseFlag = (task: InstanceType<typeof Task>) =>
      Object.defineProperty(task, 'flagged', { get: () => false, set: () => {} });

    // The move to another project succeeds, then a later check fails.
    refuseFlag(last);
    await expect(
      of.updateTask(idOf(last), { project: idOf(destination), flagged: true })
    ).rejects.toThrow('Write verification failed: flagged');
    expect(namesOf(home.tasks)).toEqual(['First', 'Second', 'Last']);
    expect(namesOf(destination.tasks)).toEqual(['Resident']);

    refuseFlag(first);
    await expect(of.updateTask(idOf(first), { project: null, flagged: true })).rejects.toThrow(
      'Write verification failed: flagged'
    );
    expect(namesOf(home.tasks)).toEqual(['First', 'Second', 'Last']);

    // The reorder succeeds, then a later check fails.
    refuseFlag(second);
    await expect(
      of.updateTask(idOf(second), { before: idOf(first), flagged: true })
    ).rejects.toThrow('Write verification failed: flagged');
    expect(namesOf(home.tasks)).toEqual(['First', 'Second', 'Last']);
    await expect(of.updateTask(idOf(first), { after: idOf(last), flagged: true })).rejects.toThrow(
      'Write verification failed: flagged'
    );
    expect(namesOf(home.tasks)).toEqual(['First', 'Second', 'Last']);
  });

  it('reports a partial write when a value cannot be put back', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    const task = new Task('Original', new Project('Home'));
    let name = 'Original';
    Object.defineProperty(task, 'name', {
      get: () => name,
      set: (value) => {
        if (value === 'Original') throw new Error('Rename refused');
        name = value;
      },
    });
    context.moveTasks = () => {
      throw new Error('Move refused');
    };
    const error = await failure(of.updateTask(idOf(task), { name: 'Renamed', project: null }));
    expect(error.code).toBe('partial_write');
    expect(error.message).toBe(
      'Move refused; restoration failed: project: Move refused; name: Rename refused'
    );
    expect(name).toBe('Renamed');
  });

  it('undoes reversible writes before a lifecycle write and reports a failed lifecycle write as partial', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const task = new Task('Original', new Project('Home'));
    Object.assign(task, { markComplete: () => {} });
    const error = await failure(of.updateTask(idOf(task), { name: 'Renamed', completed: true }));
    expect(error.code).toBe('partial_write');
    expect(error.message).toBe(
      'Write verification failed: completed; lifecycle write outcome may be partial; read before retrying'
    );
    expect(task.name).toBe('Renamed');

    const untouched = new Task('Untouched', new Project('Other'));
    Object.defineProperty(untouched, 'flagged', {
      get: () => false,
      set: () => {},
    });
    const reverted = await failure(
      of.updateTask(idOf(untouched), { name: 'Renamed', flagged: true, completed: true })
    );
    expect(reverted).toMatchObject({
      code: 'verification_failed',
      message: 'Write verification failed: flagged',
    });
    expect(untouched.name).toBe('Untouched');
    expect(untouched.completed).toBe(false);
  });

  it('completes, reopens, drops, and restores a task', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const task = new Task('Task', new Project('Home'));
    expect(await of.updateTask(idOf(task), { completed: true })).toMatchObject({
      completed: true,
    });
    expect(await of.updateTask(idOf(task), { completed: false })).toMatchObject({
      completed: false,
      completionDate: null,
    });
    expect(await of.updateTask(idOf(task), { dropped: true })).toMatchObject({
      dropped: true,
      effectivelyActive: false,
    });
    expect(await of.updateTask(idOf(task), { dropped: false })).toMatchObject({
      dropped: false,
      effectivelyActive: true,
    });
  });

  it('puts a project and a tag back among their original neighbors after a failed move', async () => {
    const { of, Folder, Project, Tag, context } = fakeOmniFocus();
    const source = new Folder('Source');
    const target = new Folder('Target');
    const [, middle] = ['A', 'B', 'C'].map((name) => new Project(name, source));
    const clearTags = middle.clearTags.bind(middle);
    let refuse = true;
    middle.clearTags = () => {
      if (refuse) {
        refuse = false;
        throw new Error('Tags refused');
      }
      clearTags();
    };
    await expect(
      of.updateProject(idOf(middle), { folder: idOf(target), tags: [] })
    ).rejects.toThrow('Tags refused');
    expect(namesOf(source.projects)).toEqual(['A', 'B', 'C']);
    expect(namesOf(target.projects)).toEqual([]);

    const parent = new Tag('Parent');
    const [, second] = ['One', 'Two', 'Three'].map((name) => new Tag(name));
    Object.defineProperty(second, 'status', {
      get: () => Tag.Status.Active,
      set: () => {},
    });
    await expect(
      of.updateTag(idOf(second), { parent: idOf(parent), status: 'dropped' })
    ).rejects.toThrow('Write verification failed: status');
    expect(namesOf(context.tags)).toEqual(['Parent', 'One', 'Two', 'Three']);
    expect(namesOf(parent.children)).toEqual([]);
  });

  it('deletes a created object whose remaining writes fail, and says so when it cannot', async () => {
    const { of, Tag, context } = fakeOmniFocus();
    new Tag('Real');
    await expect(of.createTask({ name: 'Task', tags: ['Missing'] })).rejects.toThrow(
      'Tag not found: Missing'
    );
    expect(context.flattenedTasks).toEqual([]);

    const move = context.moveTasks;
    let moves = 0;
    context.moveTasks = (...args: Parameters<typeof move>) => {
      if (++moves === 1) throw new Error('Move refused');
      move(...args);
    };
    await expect(of.createTask({ name: 'Task', project: null, tags: ['Real'] })).rejects.toThrow(
      'Move refused'
    );
    expect(context.flattenedTasks).toEqual([]);

    moves = 0;
    context.deleteObject = () => {};
    const error = await failure(of.createTask({ name: 'Stuck', project: null }));
    expect(error.code).toBe('partial_write');
    expect(error.message).toBe(
      'Move refused; created task cleanup failed: Created task still exists'
    );
  });
});
