export const OMNI_MUTATIONS = `
function resolveUnique(collection, reference, kind) {
  const id = collection.find(item => item.id.primaryKey === reference);
  if (id) return id;
  const matches = collection.filter(item => item.name === reference);
  if (matches.length > 1) throw new Error('Multiple ' + kind + ' matches: ' + reference + '. Use an ID.');
  if (!matches.length) throw new Error(kind + ' not found: ' + reference);
  return matches[0];
}
function resolveFolder(reference) { return resolveUnique(flattenedFolders, reference, 'Folder'); }
function resolveProject(reference) { return resolveUnique(flattenedProjects, reference, 'Project'); }
function projectType(project) {
  return project.containsSingletonActions ? 'single-action' : project.sequential ? 'sequential' : 'parallel';
}
function containerOf(task) {
  if (task.inInbox && !task.parent) return inbox;
  return task.assignedContainer || task.parent || task.containingProject || inbox;
}
function siblingsOf(container) { return container === inbox ? Array.from(inbox) : Array.from(container.tasks || container); }
function prepareMutation(kind, object, options) {
  const prepared = { tags: options.tags === undefined ? undefined : options.tags.map(findTag) };
  if (kind === 'project') {
    if (options.folder !== undefined) prepared.folder = options.folder ? resolveFolder(options.folder) : null;
    if (options.type !== undefined || options.singleActionList !== undefined || options.sequential !== undefined) {
      if (object.containsSingletonActions && options.sequential === true && options.type === undefined && options.singleActionList !== false)
        throw new Error('Single-action lists require type: sequential or singleActionList: false to convert');
      prepared.singleton = options.type !== undefined ? options.type === 'single-action' : options.singleActionList !== undefined ? options.singleActionList : !!object.containsSingletonActions;
      prepared.sequential = options.type !== undefined ? options.type === 'sequential' : prepared.singleton ? false : options.sequential === undefined ? object.sequential : options.sequential;
    }
  }
  if (kind === 'tag' && (options.parent !== undefined || options.parentId !== undefined)) {
    const parent = options.parent !== undefined ? (options.parent ? findTag(options.parent) : null) : undefined;
    const parentId = options.parentId !== undefined ? (options.parentId ? findTag(options.parentId) : null) : undefined;
    if (parent !== undefined && parentId !== undefined && parent !== parentId) throw new Error('Conflicting parent and parentId');
    prepared.parent = parent === undefined ? parentId : parent;
    let current = prepared.parent;
    while (current) {
      if (current === object) throw new Error('Cannot move a tag under itself or its descendant');
      current = current.parent;
    }
  }
  if (kind === 'task') {
    if (options.completed === true && object.repetitionRule) throw new Error('Repeating task completion requires occurrence-aware handling; no changes applied');
    if (options.project !== undefined) prepared.project = options.project ? resolveProject(options.project) : null;
    if (options.before !== undefined || options.after !== undefined) {
      prepared.anchor = flattenedTasks.find(task => task.id.primaryKey === (options.before || options.after));
      if (!prepared.anchor) throw new Error('Task not found: ' + (options.before || options.after));
      if (prepared.anchor === object) throw new Error('Cannot order a task relative to itself');
      if (containerOf(prepared.anchor) !== containerOf(object)) throw new Error('Ordering requires sibling tasks in the same container');
    }
  }
  return prepared;
}
function applyMutation(kind, object, options, prepared) {
  if (options.name !== undefined) object.name = options.name;
  if (options.note !== undefined) object.note = options.note;
  if (kind === 'project') {
    if (prepared.singleton !== undefined) {
      object.sequential = prepared.sequential;
      object.containsSingletonActions = prepared.singleton;
    }
    if (options.status !== undefined || options.completed !== undefined)
      object.status = stringToProjectStatus(options.status === undefined ? (options.completed ? 'done' : 'active') : options.status);
    if (prepared.folder !== undefined && object.parentFolder !== prepared.folder)
      moveSections([object], prepared.folder ? prepared.folder.ending : library.ending);
  }
  if (kind === 'tag') {
    if (options.status !== undefined) object.status = stringToTagStatus(options.status);
    if (prepared.parent !== undefined && object.parent !== prepared.parent)
      moveTags([object], prepared.parent ? prepared.parent.ending : tags.ending);
  }
  if (kind === 'task') {
    for (const key of ['flagged', 'estimatedMinutes']) if (options[key] !== undefined) object[key] = options[key];
    for (const key of ['due', 'defer', 'planned']) if (options[key] !== undefined) object[key + 'Date'] = options[key] ? new Date(options[key]) : null;
    if (prepared.project !== undefined) moveTasks([object], prepared.project ? prepared.project.ending : inbox.ending);
    if (prepared.anchor) moveTasks([object], options.before !== undefined ? prepared.anchor.before : prepared.anchor.after);
    if (options.completed !== undefined) { if (options.completed) object.markComplete(); else object.markIncomplete(); }
    if (options.dropped !== undefined) { if (options.dropped) object.drop(false, null); else if (object.dropDate) object.active = true; }
  }
  if (prepared.tags !== undefined) { object.clearTags(); prepared.tags.forEach(tag => object.addTag(tag)); }
}
function verifyMutation(kind, object, options, prepared) {
  function check(ok, field) { if (!ok) throw new Error('Write verification failed: ' + field); }
  for (const key of ['name', 'note', 'flagged', 'estimatedMinutes'])
    if (options[key] !== undefined) check(object[key] === options[key], key);
  if (prepared.tags !== undefined) check(JSON.stringify(object.tags.map(t => t.id.primaryKey).sort()) === JSON.stringify(prepared.tags.map(t => t.id.primaryKey).sort()), 'tags');
  if (kind === 'project') {
    if (prepared.singleton !== undefined) { check(object.containsSingletonActions === prepared.singleton, 'singleActionList'); check(object.sequential === prepared.sequential, 'sequential'); }
    if (prepared.folder !== undefined) check(object.parentFolder === prepared.folder, 'folder');
    if (options.status !== undefined || options.completed !== undefined) check(projectStatusToString(object.status) === (options.status || (options.completed ? 'done' : 'active')), 'status');
  }
  if (kind === 'tag') {
    if (prepared.parent !== undefined) check(object.parent === prepared.parent, 'parent');
    if (options.status !== undefined) check(tagStatusToString(object.status) === options.status, 'status');
  }
  if (kind === 'task') {
    if (prepared.project !== undefined) check(object.containingProject === prepared.project, 'project');
    if (prepared.anchor) {
      const siblings = siblingsOf(containerOf(object));
      const expected = siblings.indexOf(prepared.anchor) + (options.before !== undefined ? -1 : 1);
      check(containerOf(object) === containerOf(prepared.anchor) && siblings.indexOf(object) === expected, 'order');
    }
    if (options.completed !== undefined) check(object.completed === options.completed, 'completed');
    if (options.dropped !== undefined) check((object.dropDate !== null) === options.dropped, 'dropped');
    for (const key of ['due', 'defer', 'planned']) if (options[key] !== undefined)
      check((object[key + 'Date'] ? object[key + 'Date'].toISOString() : null) === (options[key] ? new Date(options[key]).toISOString() : null), key);
  }
}
function mutate(kind, object, options) {
  const prepared = prepareMutation(kind, object, options);
  const original = {};
  const originalType = kind === 'project' ? { singleton: object.containsSingletonActions, sequential: object.sequential } : null;
  for (const key of Object.keys(options)) {
    if (['folder','parent','parentId','project','before','after','type','singleActionList','sequential','completed','dropped','tags','status'].includes(key)) continue;
    original[key] = ['due','defer','planned'].includes(key) ? (object[key + 'Date'] ? object[key + 'Date'].toISOString() : null) : object[key];
  }
  if (options.tags !== undefined) original.tags = object.tags.map(t => t.id.primaryKey);
  if (kind === 'project') {
    if (prepared.singleton !== undefined) original.type = projectType(object);
    if (prepared.folder !== undefined) original.folder = object.parentFolder ? object.parentFolder.id.primaryKey : null;
    if (options.status !== undefined || options.completed !== undefined) original.status = projectStatusToString(object.status);
  }
  if (kind === 'tag') {
    if (prepared.parent !== undefined) original.parent = object.parent ? object.parent.id.primaryKey : null;
    if (options.status !== undefined) original.status = tagStatusToString(object.status);
  }
  let originalContainer, originalNext, originalPrevious;
  let originalPeerNext, originalPeerPrevious, originalPeerParent;
  if ((kind === 'project' && prepared.folder !== undefined) || (kind === 'tag' && prepared.parent !== undefined)) {
    originalPeerParent = kind === 'project' ? object.parentFolder : object.parent;
    const peers = kind === 'project' ? flattenedSections.filter(item => item.parentFolder === originalPeerParent || item.parent === originalPeerParent) : flattenedTags.filter(item => item.parent === originalPeerParent);
    const index = peers.indexOf(object);
    originalPeerNext = peers[index + 1]; originalPeerPrevious = peers[index - 1];
  }
  if (kind === 'task' && (prepared.anchor || prepared.project !== undefined)) {
    originalContainer = containerOf(object);
    const siblings = siblingsOf(originalContainer);
    originalNext = siblings[siblings.indexOf(object) + 1];
    originalPrevious = siblings[siblings.indexOf(object) - 1];
  }
  try { applyMutation(kind, object, options, prepared); verifyMutation(kind, object, options, prepared); }
  catch (error) {
    if (kind === 'task' && (options.completed !== undefined || options.dropped !== undefined))
      throw new Error(error.message + '; lifecycle write outcome may be partial; read before retrying');
    try {
      const recovery = prepareMutation(kind, object, original);
      if (originalType && prepared.singleton !== undefined) { recovery.singleton = originalType.singleton; recovery.sequential = originalType.sequential; }
      applyMutation(kind, object, original, recovery);
      verifyMutation(kind, object, original, recovery);
      if (kind === 'project' && prepared.folder !== undefined) {
        moveSections([object], originalPeerNext ? originalPeerNext.before : originalPeerPrevious ? originalPeerPrevious.after : originalPeerParent ? originalPeerParent.ending : library.ending);
      }
      if (kind === 'tag' && prepared.parent !== undefined) {
        moveTags([object], originalPeerNext ? originalPeerNext.before : originalPeerPrevious ? originalPeerPrevious.after : originalPeerParent ? originalPeerParent.ending : tags.ending);
      }
      if (originalPeerParent !== undefined) {
        const peers = kind === 'project' ? flattenedSections.filter(item => item.parentFolder === originalPeerParent || item.parent === originalPeerParent) : flattenedTags.filter(item => item.parent === originalPeerParent);
        const index = peers.indexOf(object);
        if (peers[index - 1] !== originalPeerPrevious || peers[index + 1] !== originalPeerNext) throw new Error('Original sibling placement was not restored');
      }
      if (originalContainer) {
        moveTasks([object], originalNext ? originalNext.before : originalContainer.ending);
        const restored = siblingsOf(originalContainer);
        const index = restored.indexOf(object);
        if (containerOf(object) !== originalContainer || restored[index + 1] !== originalNext || restored[index - 1] !== originalPrevious) throw new Error('Original placement was not restored');
      }
    } catch (restoreError) { throw new Error(error.message + '; restoration failed: ' + restoreError.message); }
    throw error;
  }
}
`;
