import { describe, expect, it } from 'bun:test';
import { fakeOmniFocus } from './fixtures/fake-omnifocus.js';

const idOf = (object: { id: { primaryKey: string } }) => object.id.primaryKey;
const names = (list: { name: string }[]) => list.map((item) => item.name);

describe('task reads', () => {
  it('serializes a task with its project, parent, tags, and dates', async () => {
    const { of, Project, Tag, Task } = fakeOmniFocus();
    const project = new Project('Project');
    const group = new Task('Group', project);
    const task = new Task('Task', group);
    task.addTag(new Tag('Home'));
    Object.assign(task, {
      note: 'note',
      flagged: true,
      estimatedMinutes: 15,
      dueDate: new Date('2026-12-01T10:00:00Z'),
      added: new Date('2026-11-01T00:00:00Z'),
    });
    expect(await of.getTask(idOf(task))).toEqual({
      id: idOf(task),
      name: 'Task',
      note: 'note',
      completed: false,
      dropped: false,
      effectivelyActive: true,
      flagged: true,
      project: 'Project',
      projectId: idOf(project),
      parentTaskId: idOf(group),
      tags: ['Home'],
      defer: null,
      due: '2026-12-01T10:00:00.000Z',
      planned: null,
      estimatedMinutes: 15,
      completionDate: null,
      added: '2026-11-01T00:00:00.000Z',
      modified: null,
    });
    expect(await of.getTask(idOf(group))).toMatchObject({ parentTaskId: null, note: null });
    expect(await of.getTask('Task')).toMatchObject({ id: idOf(task) });
    await expect(of.getTask('Missing')).rejects.toMatchObject({
      code: 'not_found',
      statusCode: 404,
      message: 'Task not found: Missing',
    });
  });

  it('lists a project as its own root task, as OmniFocus does', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const project = new Project('Project');
    new Task('Task', project);
    const listed = await of.listTasks();
    expect(names(listed)).toEqual(['Project', 'Task']);
    expect(listed[0]).toMatchObject({
      id: idOf(project),
      projectId: idOf(project),
      parentTaskId: null,
    });
    expect(names(await of.listTasks({ project: 'Project' }))).toEqual(['Task']);
  });

  it('filters by completion, activity, flag, project, and tag', async () => {
    const { of, Project, Tag, Task } = fakeOmniFocus();
    const project = new Project('Project');
    const tag = new Tag('Errand');
    const open = new Task('Open', project);
    open.addTag(tag);
    new Task('Done', project).markComplete(null);
    new Task('Dropped', project).drop(false, null);
    const flagged = new Task('Flagged');
    flagged.flagged = true;
    const blocked = new Task('Blocked flag');
    blocked.flagged = true;
    blocked.statusOverride = Task.Status.Blocked;

    expect(names(await of.listTasks())).toEqual(['Project', 'Open', 'Flagged', 'Blocked flag']);
    expect(names(await of.listTasks({ includeCompleted: true }))).toContain('Done');
    expect(names(await of.listTasks({ includeDropped: true }))).toContain('Dropped');
    expect(names(await of.listTasks({ flagged: true }))).toEqual(['Flagged']);
    expect(names(await of.listTasks({ tag: 'Errand' }))).toEqual(['Open']);
    expect(names(await of.listTasks({ project: idOf(project), includeCompleted: true }))).toEqual([
      'Open',
      'Done',
    ]);
    await expect(of.listTasks({ project: 'Missing' })).rejects.toThrow(
      'Project not found: Missing'
    );
    new Project('Project');
    await expect(of.listTasks({ project: 'Project' })).rejects.toMatchObject({
      code: 'ambiguous',
      statusCode: 400,
    });
  });

  it('searches names and notes of remaining tasks without regard to case', async () => {
    const { of, Task } = fakeOmniFocus();
    new Task('Call the BANK');
    new Task('Other').note = 'bank statement';
    new Task('Bank holiday').markComplete(null);
    expect(names(await of.searchTasks('bank'))).toEqual(['Call the BANK', 'Other']);
    expect(await of.searchTasks('nothing')).toEqual([]);
  });

  it('lists and counts remaining inbox tasks, including subtasks', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const parent = new Task('Parent');
    new Task('Child', parent);
    new Task('Finished').markComplete(null);
    new Task('Filed', new Project('Project'));
    expect(names(await of.listInboxTasks())).toEqual(['Parent', 'Child']);
    expect(await of.getInboxCount()).toBe(2);
    expect((await of.listInboxTasks())[1]).toMatchObject({
      project: null,
      parentTaskId: idOf(parent),
    });
  });

  it('summarizes tasks', async () => {
    const { of, Project, Tag, Task } = fakeOmniFocus();
    const project = new Project('Project');
    const tag = new Tag('Errand');
    const overdue = new Task('Overdue', project);
    Object.assign(overdue, {
      dueDate: new Date('2020-01-01T00:00:00Z'),
      flagged: true,
      estimatedMinutes: 30,
    });
    overdue.addTag(tag);
    new Task('Done', project).markComplete(null);
    new Task('Dropped', project).drop(false, null);
    new Task('Inbox').estimatedMinutes = 10;
    expect(await of.getTaskStats()).toEqual({
      totalTasks: 5,
      activeTasks: 3,
      completedTasks: 1,
      flaggedTasks: 1,
      overdueActiveTasks: 1,
      avgEstimatedMinutes: 20,
      tasksWithEstimates: 2,
      completionRate: 25,
      tasksByProject: [
        { name: 'Project', taskCount: 3 },
        { name: 'Inbox', taskCount: 1 },
      ],
      tasksByTag: [{ name: 'Errand', taskCount: 1 }],
    });
  });
});

describe('project reads', () => {
  it('serializes a project with its folder, type, and task counts', async () => {
    const { of, Folder, Project, Tag, Task } = fakeOmniFocus();
    const folder = new Folder('Area');
    const project = new Project('Project', folder);
    project.sequential = true;
    project.addTag(new Tag('Home'));
    new Task('One', project);
    new Task('Two', new Task('Group', project)).markComplete(null);
    expect(await of.getProject('Project')).toEqual({
      id: idOf(project),
      name: 'Project',
      note: null,
      status: 'active',
      folder: 'Area',
      sequential: true,
      type: 'sequential',
      singleActionList: false,
      folderId: idOf(folder),
      taskCount: 3,
      remainingCount: 2,
      tags: ['Home'],
    });
    await expect(of.getProject('Missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('hides finished projects and projects in dropped folders unless a filter asks for them', async () => {
    const { of, Folder, Project } = fakeOmniFocus();
    const area = new Folder('Area');
    const retired = new Folder('Retired');
    retired.status = Folder.Status.Dropped;
    new Project('Active', area);
    new Project('Held', area).status = Project.Status.OnHold;
    new Project('Done', area).status = Project.Status.Done;
    new Project('Dropped').status = Project.Status.Dropped;
    new Project('Orphaned', retired);

    expect(names(await of.listProjects())).toEqual(['Active', 'Held']);
    expect(names(await of.listProjects({ includeDropped: true }))).toEqual([
      'Active',
      'Held',
      'Done',
      'Orphaned',
      'Dropped',
    ]);
    expect(names(await of.listProjects({ status: 'on hold' }))).toEqual(['Held']);
    expect(names(await of.listProjects({ status: 'active' }))).toEqual(['Active', 'Orphaned']);
    expect(names(await of.listProjects({ folder: 'Area' }))).toEqual(['Active', 'Held']);
    expect(names(await of.listProjects({ folder: 'Area', status: 'done' }))).toEqual(['Done']);
  });

  it('summarizes projects', async () => {
    const { of, Project, Task } = fakeOmniFocus();
    const big = new Project('Big');
    big.sequential = true;
    new Task('One', big);
    new Task('Two', big).markComplete(null);
    new Project('Empty').status = Project.Status.OnHold;
    new Project('Done').status = Project.Status.Done;
    new Project('Dropped').status = Project.Status.Dropped;
    expect(await of.getProjectStats()).toEqual({
      totalProjects: 4,
      activeProjects: 1,
      onHoldProjects: 1,
      droppedProjects: 1,
      doneProjects: 1,
      sequentialProjects: 1,
      parallelProjects: 1,
      avgTasksPerProject: 1,
      avgRemainingPerProject: 0.5,
      avgCompletionRate: 50,
      projectsWithMostTasks: [
        { name: 'Big', taskCount: 2 },
        { name: 'Empty', taskCount: 0 },
      ],
      projectsWithMostRemaining: [{ name: 'Big', remainingCount: 1 }],
    });
  });
});

describe('tag reads', () => {
  it('serializes a tag and resolves it by ID, name, or path', async () => {
    const { of, Tag, Task } = fakeOmniFocus();
    const parent = new Tag('Area');
    const tag = new Tag('Work', parent);
    tag.added = new Date('2026-01-01T00:00:00Z');
    const open = new Task('Open');
    open.addTag(tag);
    open.modified = new Date('2026-03-01T00:00:00Z');
    const done = new Task('Done');
    done.addTag(tag);
    done.markComplete(new Date('2026-06-01T00:00:00Z'));
    const expected = {
      id: idOf(tag),
      name: 'Work',
      taskCount: 2,
      remainingTaskCount: 1,
      added: '2026-01-01T00:00:00.000Z',
      modified: null,
      lastActivity: '2026-06-01T00:00:00.000Z',
      active: true,
      status: 'active' as const,
      parent: 'Area',
      parentId: idOf(parent),
      children: [],
      allowsNextAction: true,
    };
    for (const reference of [idOf(tag), 'Work', 'Area/Work']) {
      expect(await of.getTag(reference)).toEqual(expected);
    }
    expect((await of.getTag('Area')).children).toEqual(['Work']);

    new Tag('Work');
    const ambiguous = await of.getTag('Work').then(
      () => null,
      (error: Error & { code?: string }) => error
    );
    expect(ambiguous?.code).toBe('ambiguous');
    expect(ambiguous?.message).toContain('Area/Work');
    expect(ambiguous?.message).toContain(idOf(tag));
    expect((await of.getTag('Area/Work')).id).toBe(idOf(tag));
    await expect(of.getTag('Area/Missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('lists tags by name, usage, or activity, and filters by days unused', async () => {
    const { of, Tag, Task } = fakeOmniFocus();
    const quiet = new Tag('Quiet');
    quiet.added = new Date('2020-01-01T00:00:00Z');
    const busy = new Tag('Busy');
    const never = new Tag('Alpha');
    for (const name of ['One', 'Two']) {
      const task = new Task(name);
      task.addTag(busy);
      task.modified = new Date();
    }
    const finished = new Task('Finished');
    finished.addTag(quiet);
    finished.markComplete(new Date('2020-02-01T00:00:00Z'));

    expect(names(await of.listTags())).toEqual(['Alpha', 'Busy', 'Quiet']);
    expect(names(await of.listTags({ sortBy: 'usage' }))).toEqual(['Busy', 'Quiet', 'Alpha']);
    expect(names(await of.listTags({ sortBy: 'activity' }))).toEqual(['Busy', 'Quiet', 'Alpha']);
    expect(names(await of.listTags({ unusedDays: 30 }))).toEqual(['Alpha', 'Quiet']);
    const activeOnly = await of.listTags({ activeOnly: true });
    expect(activeOnly.find((tag) => tag.name === 'Quiet')).toMatchObject({
      taskCount: 0,
      remainingTaskCount: 0,
      lastActivity: '2020-01-01T00:00:00.000Z',
    });
    expect(never.tasks).toEqual([]);
  });

  it('summarizes tags', async () => {
    const { of, Tag, Task } = fakeOmniFocus();
    const busy = new Tag('Busy');
    const stale = new Tag('Stale');
    stale.status = Tag.Status.OnHold;
    stale.modified = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    new Tag('Unused');
    for (const name of ['One', 'Two']) new Task(name).addTag(busy);
    new Task('Three').addTag(stale);
    for (const task of busy.tasks) task.modified = new Date();
    expect(await of.getTagStats()).toEqual({
      totalTags: 3,
      activeTags: 2,
      tagsWithTasks: 2,
      unusedTags: 1,
      avgTasksPerTag: 1.5,
      mostUsedTags: [
        { name: 'Busy', taskCount: 2 },
        { name: 'Stale', taskCount: 1 },
        { name: 'Unused', taskCount: 0 },
      ],
      leastUsedTags: [
        { name: 'Stale', taskCount: 1 },
        { name: 'Busy', taskCount: 2 },
      ],
      staleTags: [{ name: 'Stale', daysSinceActivity: 45 }],
    });
  });

  it('creates a tag at the root or under a parent, and deletes it from its tasks', async () => {
    const { of, Tag, Task, context } = fakeOmniFocus();
    new Tag('Existing');
    const root = await of.createTag({ name: 'Root' });
    expect(context.tags.map((tag) => tag.name)).toEqual(['Root', 'Existing']);
    const child = await of.createTag({ name: 'Child', parent: root.id, status: 'on hold' });
    expect(child).toMatchObject({ parent: 'Root', parentId: root.id, status: 'on hold' });
    await expect(of.createTag({ name: 'Lost', parent: 'Missing' })).rejects.toThrow(
      'Tag not found: Missing'
    );
    const task = new Task('Task');
    await of.updateTask(idOf(task), { tags: [child.id] });
    await of.deleteTag(child.id);
    expect(task.tags).toEqual([]);
    await expect(of.getTag(child.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('deletion', () => {
  it('deletes a task or a project and reports a missing target', async () => {
    const { of, Project, Task, context } = fakeOmniFocus();
    const project = new Project('Project');
    const task = new Task('Task', project);
    await of.deleteTask(idOf(task));
    expect(project.tasks).toEqual([]);
    await expect(of.deleteTask(idOf(task))).rejects.toMatchObject({ code: 'not_found' });
    await of.deleteProject('Project');
    expect(context.flattenedProjects).toEqual([]);
    await expect(of.deleteProject('Project')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('perspective reads', () => {
  it('lists built-in perspectives, then custom ones with their identifiers', async () => {
    const { of, perspectives } = fakeOmniFocus();
    perspectives.push({
      identifier: 'custom-1',
      name: 'Muse',
      archivedFilterRules: [],
      archivedTopLevelFilterAggregation: null,
    });
    expect(await of.listPerspectives()).toEqual([
      ...['Inbox', 'Flagged', 'Forecast', 'Projects', 'Tags', 'Nearby', 'Review'].map((name) => ({
        id: name,
        name,
      })),
      { id: 'Muse', name: 'Muse', identifier: 'custom-1' },
    ]);
  });

  it('switches the front window to a perspective and returns the tasks it shows', async () => {
    const { of, Task, perspectives, frontWindow, windows, context } = fakeOmniFocus();
    const custom = {
      identifier: 'custom-1',
      name: 'Muse',
      archivedFilterRules: [],
      archivedTopLevelFilterAggregation: null,
    };
    perspectives.push(custom);
    frontWindow.visibleTasks = [new Task('Shown')];

    expect(names(await of.getPerspectiveTasks('inbox'))).toEqual(['Shown']);
    expect(frontWindow.perspective).toBe(context.Perspective.BuiltIn.Inbox);
    for (const reference of ['Muse', 'custom-1']) {
      frontWindow.perspective = null;
      await of.getPerspectiveTasks(reference);
      expect(frontWindow.perspective).toBe(custom);
    }
    for (const reference of ['Missing', 'constructor']) {
      await expect(of.getPerspectiveTasks(reference)).rejects.toMatchObject({
        code: 'not_found',
        message: `Perspective not found: ${reference}`,
      });
    }
    expect(frontWindow.perspective).toBe(custom);
    windows.length = 0;
    await expect(of.getPerspectiveTasks('Inbox')).rejects.toThrow('No OmniFocus window is open');
  });
});
