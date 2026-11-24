import { describe, expect, it, spyOn } from 'bun:test';
import { OmniFocus } from '../omnifocus.js';
import { createFolderCommand } from '../../commands/folder.js';
import { fakeOmniFocus } from './fixtures/fake-omnifocus.js';

const idOf = (object: { id: { primaryKey: string } }) => object.id.primaryKey;

describe('folder creation', () => {
  it('creates once and returns the same folder on a repeat call', async () => {
    const { of, context } = fakeOmniFocus();
    const created = await of.createFolder('Work');
    expect(created).toEqual({
      id: created.id,
      name: 'Work',
      status: 'active',
      effectivelyActive: true,
      parent: null,
      projectCount: 0,
      remainingProjectCount: 0,
      folderCount: 0,
      children: [],
      alreadyExisted: false,
    });
    expect(await of.createFolder('Work')).toMatchObject({
      id: created.id,
      name: 'Work',
      alreadyExisted: true,
    });
    expect(context.folders.map((folder) => folder.name)).toEqual(['Work']);
    expect(await of.listFolders()).toMatchObject([{ id: created.id, name: 'Work' }]);
  });

  it('reuses a dropped top-level folder without changing its status', async () => {
    const { of, Folder, context } = fakeOmniFocus();
    const existing = new Folder('Work');
    existing.status = Folder.Status.Dropped;
    expect(await of.createFolder('Work')).toMatchObject({
      id: idOf(existing),
      name: 'Work',
      status: 'dropped',
      effectivelyActive: false,
      alreadyExisted: true,
    });
    expect(context.folders.length).toBe(1);
  });

  it('creates and reuses exact direct child names independently under different parents', async () => {
    const { of } = fakeOmniFocus();
    const home = await of.createFolder('Home');
    const work = await of.createFolder('Work');
    const root = await of.createFolder('Someday');
    const homeChild = await of.createFolder('Someday', home.id);
    const workChild = await of.createFolder('Someday', 'Work');
    const grandchild = await of.createFolder('Someday', homeChild.id);
    expect(homeChild).toMatchObject({ parent: 'Home', alreadyExisted: false });
    expect(workChild).toMatchObject({ parent: 'Work', alreadyExisted: false });
    expect(new Set([root.id, homeChild.id, workChild.id, grandchild.id]).size).toBe(4);
    expect(await of.createFolder('Someday', 'Home')).toMatchObject({
      id: homeChild.id,
      alreadyExisted: true,
    });
    expect(await of.listFolders()).toMatchObject([
      { id: home.id, children: [{ id: homeChild.id, children: [{ id: grandchild.id }] }] },
      { id: work.id, children: [{ id: workChild.id }] },
      { id: root.id, children: [] },
    ]);
  });

  it('reports ambiguous and missing folder parents without creating anything', async () => {
    const { of } = fakeOmniFocus();
    const first = await of.createFolder('Parent');
    const second = await of.createFolder('Parent', first.id);
    await expect(of.createFolder('Child', 'Parent')).rejects.toMatchObject({
      code: 'ambiguous',
      statusCode: 400,
      changes: 'none',
      message: expect.stringContaining(first.id),
    });
    await expect(of.createFolder('Child', 'parent')).rejects.toMatchObject({
      code: 'not_found',
      statusCode: 404,
      changes: 'none',
    });
    expect(await of.listFolders()).toMatchObject([
      { id: first.id, children: [{ id: second.id, children: [] }] },
    ]);
    expect(await of.createFolder('Child', second.id)).toMatchObject({ parent: 'Parent' });
  });

  it('rejects empty and null folder parents', async () => {
    const { of } = fakeOmniFocus();
    for (const parent of ['', null]) {
      await expect(of.createFolder('Child', parent as string)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('parent:'),
      });
    }
    expect(await of.listFolders()).toEqual([]);
  });

  it('matches exact top-level names and ignores nested names', async () => {
    const { of, Folder, context } = fakeOmniFocus();
    const parent = new Folder('Parent');
    new Folder('Work', parent);
    new Folder('work');
    expect(await of.createFolder('Work')).toMatchObject({
      name: 'Work',
      parent: null,
      alreadyExisted: false,
    });
    expect(context.folders.map((folder) => folder.name)).toEqual(['Parent', 'work', 'Work']);
  });

  it('round trips quotes, backslashes, and control characters without executing the name', async () => {
    const { of, context } = fakeOmniFocus();
    const name = 'Work "quoted" \\ path\n\r\t"); throw new Error("injected"); //   ${1}`';
    expect(await of.createFolder(name)).toMatchObject({ name, alreadyExisted: false });
    expect(await of.createFolder(name)).toMatchObject({ name, alreadyExisted: true });
    expect(context.folders.length).toBe(1);
  });

  it('propagates bridge failures to the caller', async () => {
    const { of, execute } = fakeOmniFocus();
    execute.mockRejectedValue(new Error('Automation failed'));
    await expect(of.createFolder('Work')).rejects.toThrow('Automation failed');
  });

  it('still rejects a missing folder when creating a project', async () => {
    const { of, context } = fakeOmniFocus();
    await expect(of.createProject({ name: 'Project', folder: 'Missing' })).rejects.toThrow(
      'Folder not found: Missing'
    );
    expect(context.flattenedProjects).toEqual([]);
  });

  it('registers the CLI command and prints the creation result as JSON', async () => {
    const result = {
      id: 'folder-1',
      name: 'Work',
      status: 'active' as const,
      effectivelyActive: true,
      parent: null,
      projectCount: 0,
      remainingProjectCount: 0,
      folderCount: 0,
      children: [],
      alreadyExisted: true,
    };
    const create = spyOn(OmniFocus.prototype, 'createFolder').mockResolvedValue(result);
    const output = spyOn(console, 'log').mockImplementation(() => {});
    try {
      await createFolderCommand().parseAsync(['create', 'Work'], { from: 'user' });
      expect(create.mock.calls).toEqual([['Work', undefined]]);
      expect(output.mock.calls).toEqual([[JSON.stringify(result, null, 2)]]);
    } finally {
      create.mockRestore();
      output.mockRestore();
    }
  });
});

describe('folder reads and deletion', () => {
  it('counts the projects in a folder that are neither dropped nor done', async () => {
    const { of, Folder, Project } = fakeOmniFocus();
    const folder = new Folder('Area');
    new Project('Active', folder);
    new Project('Held', folder).status = Project.Status.OnHold;
    new Project('Finished', folder).status = Project.Status.Done;
    new Project('Abandoned', folder).status = Project.Status.Dropped;
    expect(await of.getFolder('Area')).toMatchObject({
      projectCount: 4,
      remainingProjectCount: 2,
    });
    folder.status = Folder.Status.Dropped;
    expect(await of.getFolder('Area')).toMatchObject({
      status: 'dropped',
      effectivelyActive: false,
      projectCount: 4,
      remainingProjectCount: 0,
    });
  });

  it('nests child folders and hides dropped ones unless asked', async () => {
    const { of, Folder } = fakeOmniFocus();
    const parent = new Folder('Parent');
    new Folder('Kept', parent);
    new Folder('Gone', parent).status = Folder.Status.Dropped;
    new Folder('Retired').status = Folder.Status.Dropped;
    const listed = await of.listFolders();
    expect(listed.map((folder) => folder.name)).toEqual(['Parent']);
    expect(listed[0]).toMatchObject({ folderCount: 2 });
    expect(listed[0].children.map((child) => child.name)).toEqual(['Kept']);
    expect(listed[0].children[0].parent).toBe('Parent');
    const all = await of.listFolders({ includeDropped: true });
    expect(all.map((folder) => folder.name)).toEqual(['Parent', 'Retired']);
    expect(all[0].children.map((child) => child.name)).toEqual(['Kept', 'Gone']);
    expect(
      (await of.getFolder(parent.id.primaryKey, { includeDropped: true })).children.length
    ).toBe(2);
    await expect(of.getFolder('Missing')).rejects.toThrow('Folder not found: Missing');
  });

  it('deletes only an empty folder', async () => {
    const { of, Folder, Project, context } = fakeOmniFocus();
    const full = new Folder('Full');
    new Project('Inside', full);
    new Folder('Empty');
    await expect(of.deleteFolder('Full')).rejects.toMatchObject({
      code: 'invalid',
      statusCode: 400,
      message: 'Folder must be empty to delete',
    });
    await of.deleteFolder('Empty');
    expect(context.folders.map((folder) => folder.name)).toEqual(['Full']);
    await expect(of.deleteFolder('Empty')).rejects.toMatchObject({ code: 'not_found' });
  });
});
