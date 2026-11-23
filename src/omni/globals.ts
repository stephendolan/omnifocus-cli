// Omni Automation exposes the default Database's members as globals inside
// evaluateJavascript. Each global takes its type from the generated Database
// class, so a name OmniFocus does not provide fails the type check.
//
// This is a .ts file rather than a .d.ts so that skipLibCheck does not hide an
// unknown member.
declare global {
  const flattenedTasks: Database['flattenedTasks'];
  const flattenedProjects: Database['flattenedProjects'];
  const flattenedFolders: Database['flattenedFolders'];
  const flattenedTags: Database['flattenedTags'];
  const folders: Database['folders'];
  const tags: Database['tags'];
  const inbox: Database['inbox'];
  const library: Database['library'];
  const moveTasks: Database['moveTasks'];
  const moveSections: Database['moveSections'];
  const moveTags: Database['moveTags'];
  const deleteObject: Database['deleteObject'];
}

export {};
