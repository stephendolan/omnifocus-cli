// Type-level checks, never bundled or run. Each @ts-expect-error fails the
// type check if the line below it stops being an error, which is how a
// regenerated omniautomation.d.ts that lost its element types, or a property
// OmniFocus does not provide, gets noticed.

export function collectionElementsAreTyped(project: Project, tag: Tag, folder: Folder) {
  // @ts-expect-error elements of flattenedTasks are Task
  void flattenedTasks[0].noSuchProperty;
  // @ts-expect-error elements of Project.tasks are Task
  void project.tasks[0].noSuchProperty;
  // @ts-expect-error elements of Tag.children are Tag
  void tag.children[0].noSuchProperty;
  // @ts-expect-error elements of Folder.projects are Project
  void folder.projects[0].noSuchProperty;
  for (const task of inbox) {
    // @ts-expect-error iterating the inbox yields Task
    void task.noSuchProperty;
  }
}

export function projectsHaveNoEffectiveActive(project: Project) {
  // @ts-expect-error Project is not an ActiveObject; see projectIsRemaining
  return project.effectiveActive;
}

export function unknownDatabaseGlobalsAreErrors() {
  // @ts-expect-error OmniFocus moves projects with moveSections
  moveProjects([], library.ending);
}
