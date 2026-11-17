import { describe, expect, it, mock, spyOn } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { OmniFocus } from '../omnifocus.js';
import { createFolderCommand } from '../../commands/folder.js';

function folderDatabase() {
  const folders: MockFolder[] = [];
  const ending = {};

  class MockFolder {
    static Status = { Active: 'active', Dropped: 'dropped' };
    id: { primaryKey: string };
    status = 'active';
    effectiveActive = true;
    parent: MockFolder | null = null;
    folders: MockFolder[] = [];
    projects: { effectiveActive: boolean }[] = [];

    constructor(
      public name: string,
      position: object
    ) {
      if (position !== ending) throw new Error('Expected top-level library insertion');
      this.id = { primaryKey: `folder-${folders.length + 1}` };
      folders.push(this);
    }
  }

  const of = new OmniFocus();
  const execute = mock(async (script: string) =>
    runInNewContext(script, {
      ObjC: { import() {}, bindFunction() {} },
      $: {
        NSAppleEventDescriptor: { descriptorWithBundleIdentifier: () => ({ aeDesc: {} }) },
        AEDeterminePermissionToAutomateTarget: () => 0,
      },
      Application: () => ({
        evaluateJavascript: (omniScript: string) =>
          runInNewContext(omniScript, {
            Folder: MockFolder,
            folders,
            flattenedFolders: folders,
            library: { ending },
          }),
      }),
    })
  );
  of['executeJXA'] = execute;
  return { of, folders, MockFolder, ending, execute };
}

describe('folder creation', () => {
  it('creates once and returns the same folder on a repeat call', async () => {
    const { of, folders } = folderDatabase();
    expect(await of.createFolder('Work')).toEqual({
      id: 'folder-1',
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
      id: 'folder-1',
      name: 'Work',
      alreadyExisted: true,
    });
    expect(folders.map((folder) => folder.name)).toEqual(['Work']);
    expect(await of.listFolders()).toMatchObject([{ id: 'folder-1', name: 'Work' }]);
  });

  it('reuses a dropped top-level folder without changing its status', async () => {
    const { of, folders, MockFolder, ending } = folderDatabase();
    const existing = new MockFolder('Work', ending);
    existing.status = 'dropped';
    existing.effectiveActive = false;
    expect(await of.createFolder('Work')).toMatchObject({
      id: 'folder-1',
      name: 'Work',
      status: 'dropped',
      effectivelyActive: false,
      alreadyExisted: true,
    });
    expect(folders.length).toBe(1);
  });

  it('matches exact top-level names and ignores nested names', async () => {
    const { of, folders, MockFolder, ending } = folderDatabase();
    const parent = new MockFolder('Parent', ending);
    const nested = new MockFolder('Work', ending);
    folders.pop();
    nested.parent = parent;
    parent.folders.push(nested);
    new MockFolder('work', ending);
    expect(await of.createFolder('Work')).toMatchObject({
      id: 'folder-3',
      name: 'Work',
      parent: null,
      alreadyExisted: false,
    });
    expect(folders.map((folder) => folder.name)).toEqual(['Parent', 'work', 'Work']);
  });

  it('round trips quotes, backslashes, and control characters without executing the name', async () => {
    const { of, folders } = folderDatabase();
    const name = 'Work "quoted" \\ path\n\r\t"); throw new Error("injected"); //';
    expect(await of.createFolder(name)).toMatchObject({ name, alreadyExisted: false });
    expect(await of.createFolder(name)).toMatchObject({ name, alreadyExisted: true });
    expect(folders.length).toBe(1);
  });

  it('propagates bridge failures to the caller', async () => {
    const { of, execute } = folderDatabase();
    execute.mockRejectedValue(new Error('Automation failed'));
    await expect(of.createFolder('Work')).rejects.toThrow('Automation failed');
  });

  it('still rejects a missing folder when creating a project', async () => {
    const { of } = folderDatabase();
    await expect(of.createProject({ name: 'Project', folder: 'Missing' })).rejects.toThrow(
      'Folder not found: Missing'
    );
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
      expect(create.mock.calls).toEqual([['Work']]);
      expect(output.mock.calls).toEqual([[JSON.stringify(result, null, 2)]]);
    } finally {
      create.mockRestore();
      output.mockRestore();
    }
  });
});
