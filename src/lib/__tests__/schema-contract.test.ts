import { describe, expect, it } from 'bun:test';
import type { z } from 'zod';
import type * as omni from '../../omni/runtime.js';
import {
  folderFilters,
  projectCreate,
  projectFilters,
  projectMutation,
  tagCreate,
  tagListOptions,
  tagUpdate,
  taskCreate,
  taskFilters,
  taskUpdate,
} from '../mutations.js';

// The runtime declares its argument types by hand, because it cannot import
// the schemas. A schema field the runtime type lacks would be accepted,
// validated, and then ignored inside OmniFocus. Each line below stops
// type-checking when a schema gains such a field.
type Unhandled<Schema, Runtime> = Exclude<keyof Schema, keyof Runtime>;
type None<T extends never> = T;

type _TaskCreate = None<Unhandled<z.output<typeof taskCreate>, omni.TaskChanges>>;
type _TaskUpdate = None<Unhandled<z.output<typeof taskUpdate>, omni.TaskChanges>>;
type _ProjectCreate = None<Unhandled<z.output<typeof projectCreate>, omni.ProjectChanges>>;
type _ProjectUpdate = None<Unhandled<z.output<typeof projectMutation>, omni.ProjectChanges>>;
type _TagCreate = None<Unhandled<z.output<typeof tagCreate>, omni.TagChanges>>;
type _TagUpdate = None<Unhandled<z.output<typeof tagUpdate>, omni.TagChanges>>;
type _TaskFilters = None<
  Unhandled<z.output<typeof taskFilters>, Parameters<typeof omni.listTasks>[0]>
>;
type _ProjectFilters = None<
  Unhandled<z.output<typeof projectFilters>, Parameters<typeof omni.listProjects>[0]>
>;
type _TagList = None<
  Unhandled<
    z.output<typeof tagListOptions>,
    Parameters<typeof omni.listTags>[0] & { sortBy?: string }
  >
>;
type _FolderFilters = None<
  Unhandled<z.output<typeof folderFilters>, Parameters<typeof omni.listFolders>[0]>
>;

describe('schemas and runtime argument types', () => {
  it('reject unknown fields, so nothing reaches the runtime unnamed', () => {
    for (const schema of [
      taskCreate,
      taskUpdate,
      projectCreate,
      projectMutation,
      tagCreate,
      tagUpdate,
      taskFilters,
      projectFilters,
      tagListOptions,
      folderFilters,
    ]) {
      expect(schema.safeParse({ name: 'x', notAField: true }).success).toBe(false);
    }
  });
});
