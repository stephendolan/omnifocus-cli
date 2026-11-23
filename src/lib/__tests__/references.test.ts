import { describe, expect, it } from 'bun:test';
import { parseDateTime } from '../dates.js';
import { OmniFocusCliError, OmniFocusError } from '../errors.js';
import { fakeOmniFocus } from './fixtures/fake-omnifocus.js';

const idOf = (object: { id: { primaryKey: string } }) => object.id.primaryKey;
const names = (list: { name: string }[]) => list.map((item) => item.name);

async function failure<E extends Error = OmniFocusError>(promise: Promise<unknown>): Promise<E> {
  return promise.then(
    () => {
      throw new Error('Expected a rejection');
    },
    (error: E) => error
  );
}

describe('references to tasks, projects, and folders', () => {
  it('rejects a task name that a finished task shares, and names the candidates', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const project = new Project('Home');
    const finished = new Task('Weekly review', project);
    finished.markComplete(null);
    const dropped = new Task('Weekly review', project);
    dropped.drop(false, null);
    const current = new Task('Weekly review', project);

    for (const attempt of [
      () => of.getTask('Weekly review'),
      () => of.updateTask('Weekly review', { flagged: true }),
      () => of.deleteTask('Weekly review'),
    ]) {
      const error = await failure(attempt());
      expect(error).toMatchObject({ code: 'ambiguous', statusCode: 400, changes: 'none' });
      expect(error.message).toBe(
        `Multiple Task matches: Weekly review. Use an ID: ${idOf(finished)} (completed), ${idOf(dropped)} (dropped), ${idOf(current)} (remaining)`
      );
    }
    expect(names(project.tasks)).toEqual(['Weekly review', 'Weekly review', 'Weekly review']);
    expect(project.tasks.map((task) => task.flagged)).toEqual([false, false, false]);

    expect(await of.updateTask(idOf(current), { flagged: true })).toMatchObject({
      id: idOf(current),
      flagged: true,
    });
    expect(await of.deleteTask(idOf(finished))).toEqual({
      deleted: true,
      id: idOf(finished),
      name: 'Weekly review',
    });
  });

  it('rejects a name shared by a task and a project instead of choosing either', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const project = new Project('Taxes');
    const task = new Task('Taxes');
    const error = await failure(of.deleteTask('Taxes'));
    expect(error.code).toBe('ambiguous');
    expect(error.message).toContain(`${idOf(project)} (remaining)`);
    expect(error.message).toContain(`${idOf(task)} (remaining)`);
    expect(await of.getProject('Taxes')).toMatchObject({ id: idOf(project) });
  });

  it('will not delete, move, or reorder a project through a task call', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    const project = new Project('Renovation');
    const other = new Project('Other');
    const child = new Task('Paint', project);

    for (const reference of ['Renovation', idOf(project)]) {
      expect(await failure(of.deleteTask(reference))).toMatchObject({
        code: 'invalid',
        statusCode: 400,
        changes: 'none',
        message: 'Renovation is a project; delete it as a project, not as a task',
      });
    }
    for (const changes of [{ project: idOf(other) }, { project: null }, { before: idOf(child) }]) {
      expect(await failure(of.updateTask(idOf(project), changes))).toMatchObject({
        code: 'invalid',
        message: 'Renovation is a project; a task update cannot move or reorder it',
      });
    }
    expect(names(context.flattenedProjects)).toEqual(['Renovation', 'Other']);
    expect(names(project.tasks)).toEqual(['Paint']);

    expect(await of.updateTask(idOf(project), { flagged: true, due: '2026-12-01' })).toMatchObject({
      id: idOf(project),
      flagged: true,
    });
    expect(await of.deleteProject('Renovation')).toEqual({
      deleted: true,
      id: idOf(project),
      name: 'Renovation',
    });
  });

  it('rejects an ambiguous project or folder name wherever one is the target', async () => {
    const { of, Folder, Project } = fakeOmniFocus();
    const area = new Folder('Area');
    const nested = new Folder('Area', area);
    const active = new Project('Plan');
    const done = new Project('Plan');
    done.status = Project.Status.Done;

    for (const attempt of [
      () => of.getProject('Plan'),
      () => of.updateProject('Plan', { note: 'x' }),
      () => of.deleteProject('Plan'),
    ]) {
      const error = await failure(attempt());
      expect(error.code).toBe('ambiguous');
      expect(error.message).toBe(
        `Multiple Project matches: Plan. Use an ID: ${idOf(active)} (active), ${idOf(done)} (done)`
      );
    }
    for (const attempt of [() => of.getFolder('Area'), () => of.deleteFolder('Area')]) {
      const error = await failure(attempt());
      expect(error.code).toBe('ambiguous');
      expect(error.message).toBe(
        `Multiple Folder matches: Area. Use an ID: ${idOf(area)} (top level), ${idOf(nested)} (in Area)`
      );
    }
    expect((await of.getFolder(idOf(nested))).parent).toBe('Area');
    expect(active.note).toBe('');
  });
});

describe('filters', () => {
  it('reports a tag filter that matches no tag instead of returning nothing', async () => {
    const { of, Tag, Task } = fakeOmniFocus();
    const area = new Tag('Area');
    const nested = new Tag('Waiting', area);
    const top = new Tag('Waiting');
    new Task('Nested').addTag(nested);
    new Task('Top').addTag(top);
    new Task('Untagged');

    expect(await failure(of.listTasks({ tag: 'Waitng' }))).toMatchObject({
      code: 'not_found',
      statusCode: 404,
      message: 'Tag not found: Waitng',
    });
    expect(names(await of.listTasks({ tag: 'Waiting' }))).toEqual(['Nested', 'Top']);
    expect(names(await of.listTasks({ tag: 'Area/Waiting' }))).toEqual(['Nested']);
    expect(names(await of.listTasks({ tag: idOf(top) }))).toEqual(['Top']);
    expect(await of.listTasks({ tag: 'Area' })).toEqual([]);
  });

  it('reports a folder filter that matches no folder instead of returning nothing', async () => {
    const { of, Folder, Project } = fakeOmniFocus();
    const work = new Folder('Work');
    const nested = new Folder('Work', new Folder('Archive'));
    new Project('One', work);
    new Project('Two', nested);
    new Project('Loose');

    expect(await failure(of.listProjects({ folder: 'Wrok' }))).toMatchObject({
      code: 'not_found',
      message: 'Folder not found: Wrok',
    });
    expect(names(await of.listProjects({ folder: 'Work' }))).toEqual(['One', 'Two']);
    expect(names(await of.listProjects({ folder: idOf(nested) }))).toEqual(['Two']);
    expect(await of.listProjects({ folder: 'Archive' })).toEqual([]);
  });

  it('includes every available flagged task, whatever OmniFocus calls its status', async () => {
    const { of, Task } = fakeOmniFocus();
    for (const status of ['Available', 'Next', 'DueSoon', 'Overdue', 'Blocked'] as const) {
      const task = new Task(status);
      task.flagged = true;
      task.statusOverride = Task.Status[status];
    }
    new Task('Unflagged');
    const finished = new Task('Finished');
    finished.flagged = true;
    finished.markComplete(null);

    expect(names(await of.listTasks({ flagged: true }))).toEqual([
      'Available',
      'Next',
      'DueSoon',
      'Overdue',
    ]);
    expect(names(await of.listTasks({ flagged: true, includeCompleted: true }))).toContain(
      'Finished'
    );
  });

  it('rejects filter values no schema allows before contacting OmniFocus', async () => {
    const { of, execute } = fakeOmniFocus();
    for (const attempt of [
      () => of.listProjects({ status: 'paused' as never }),
      () => of.listTags({ sortBy: 'recent' as never }),
      () => of.listTags({ unusedDays: Number.NaN }),
      () => of.listTasks({ flaged: true } as never),
      () => of.listFolders({ includeDropped: 'yes' as never }),
    ]) {
      const error = await failure<OmniFocusCliError>(attempt());
      expect(error).toBeInstanceOf(OmniFocusCliError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toStartWith('Invalid arguments: ');
    }
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('write arguments', () => {
  it('rejects values OmniFocus cannot hold before contacting it', async () => {
    const { of, Task, execute } = fakeOmniFocus();
    const task = new Task('Task');
    for (const [attempt, detail] of [
      [() => of.updateTask(idOf(task), { estimatedMinutes: 2.5 }), 'estimatedMinutes: '],
      [() => of.updateTask(idOf(task), { name: '' }), 'name: '],
      [() => of.updateProject('x', { name: '' }), 'name: '],
      [() => of.updateTag('x', { name: '' }), 'name: '],
      [() => of.createFolder(''), 'name: '],
      [() => of.updateTask(idOf(task), { due: '2026-02-30' }), 'due: Invalid date: 2026-02-30'],
      [() => of.createTask({ name: 'x', defer: 'someday' }), 'defer: Invalid date: someday'],
    ] as const) {
      const error = await failure<OmniFocusCliError>(attempt());
      expect(error).toBeInstanceOf(OmniFocusCliError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain(`Invalid arguments: ${detail}`);
    }
    expect(execute).not.toHaveBeenCalled();
    expect(task.name).toBe('Task');
  });

  it('rejects dates that do not exist and accepts ones that do', () => {
    for (const input of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-2-30',
      '2026-04-31T10:00:00Z',
    ]) {
      expect(() => parseDateTime(input)).toThrow(`Invalid date: ${input}`);
    }
    expect(parseDateTime('2028-02-29T12:00:00Z')).toBe('2028-02-29T12:00:00.000Z');
    expect(parseDateTime('2026-12-31T23:59:59.123Z')).toBe('2026-12-31T23:59:59.123Z');
    expect(new Date(parseDateTime('2026-04-30')).getDate()).toBe(30);
  });

  it('assigns a tag once when two references name it', async () => {
    const { of, Tag, Task } = fakeOmniFocus();
    const area = new Tag('Area');
    const tag = new Tag('Work', area);
    const task = new Task('Task');
    expect(
      await of.updateTask(idOf(task), { tags: [idOf(tag), 'Work', 'Area/Work', 'Area'] })
    ).toMatchObject({ tags: ['Work', 'Area'] });
  });

  it('leaves a task in place when it is already at the top of the requested container', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    const project = new Project('Sequence');
    const [first, second] = ['First', 'Second', 'Third'].map((name) => new Task(name, project));
    await of.updateTask(idOf(first), { project: idOf(project), flagged: true });
    expect(names(project.tasks)).toEqual(['First', 'Second', 'Third']);

    const nested = new Task('Nested', second);
    expect(await of.updateTask(idOf(nested), { project: 'Sequence' })).toMatchObject({
      parentTaskId: null,
    });
    expect(names(project.tasks)).toEqual(['First', 'Second', 'Third', 'Nested']);

    const [early] = ['Early', 'Late'].map((name) => new Task(name));
    await of.updateTask(idOf(early), { project: null, note: 'still first' });
    expect(names(context.inbox)).toEqual(['Early', 'Late']);
  });

  it('reports a deletion OmniFocus did not carry out', async () => {
    const { of, Task, context } = fakeOmniFocus();
    const task = new Task('Stubborn');
    context.deleteObject = () => {};
    expect(await failure(of.deleteTask(idOf(task)))).toMatchObject({
      code: 'verification_failed',
      changes: 'unknown',
      message: `Task still exists after deletion: ${idOf(task)}`,
    });
  });

  it('counts the inbox without serializing it', async () => {
    const { of, Task } = fakeOmniFocus();
    const task = new Task('Task');
    Object.defineProperty(task, 'note', {
      get: () => {
        throw new Error('The count must not read task fields it does not need');
      },
    });
    expect(await of.getInboxCount()).toBe(1);
  });
});
