import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import type {
  Task,
  Project,
  TaskFilters,
  ProjectFilters,
  CreateTaskOptions,
  UpdateTaskOptions,
  CreateProjectOptions,
  UpdateProjectOptions,
  Perspective,
  Tag,
  TagListOptions,
  TagStats,
  TaskStats,
  ProjectStats,
  CreateTagOptions,
  UpdateTagOptions,
  Folder,
  FolderFilters,
} from '../types.js';

const execFileAsync = promisify(execFile);

export class OmniFocus {
  private readonly PROJECT_STATUS_MAP = {
    active: 'Active',
    'on hold': 'OnHold',
    dropped: 'Dropped',
  } as const;

  private readonly OMNI_HELPERS = `
    function serializeTask(task) {
      const containingProject = task.containingProject;
      const tagNames = task.tags.map(t => t.name);

      return {
        id: task.id.primaryKey,
        name: task.name,
        note: task.note || null,
        completed: task.completed,
        dropped: task.dropped,
        effectivelyActive: task.effectiveActive,
        flagged: task.flagged,
        project: containingProject ? containingProject.name : null,
        tags: tagNames,
        defer: task.deferDate ? task.deferDate.toISOString() : null,
        due: task.dueDate ? task.dueDate.toISOString() : null,
        estimatedMinutes: task.estimatedMinutes || null,
        completionDate: task.completionDate ? task.completionDate.toISOString() : null,
        added: task.added ? task.added.toISOString() : null,
        modified: task.modified ? task.modified.toISOString() : null
      };
    }

    function serializeProject(project) {
      const parentFolder = project.parentFolder;
      const allTasks = project.flattenedTasks;
      const remainingTasks = allTasks.filter(t => !t.completed);
      const tagNames = project.tags.map(t => t.name);

      return {
        id: project.id.primaryKey,
        name: project.name,
        note: project.note || null,
        status: projectStatusToString(project.status),
        folder: parentFolder ? parentFolder.name : null,
        sequential: project.sequential,
        taskCount: allTasks.length,
        remainingCount: remainingTasks.length,
        tags: tagNames
      };
    }

    function findTask(idOrName) {
      for (const task of flattenedTasks) {
        if (task.id.primaryKey === idOrName || task.name === idOrName) {
          return task;
        }
      }
      throw new Error("Task not found: " + idOrName);
    }

    function findProject(idOrName) {
      for (const project of flattenedProjects) {
        if (project.id.primaryKey === idOrName || project.name === idOrName) {
          return project;
        }
      }
      throw new Error("Project not found: " + idOrName);
    }

    function getTagPath(tag) {
      const parts = [tag.name];
      let current = tag.parent;
      while (current) {
        parts.unshift(current.name);
        current = current.parent;
      }
      return parts.join('/');
    }

    function findTag(idOrName) {
      for (const tag of flattenedTags) {
        if (tag.id.primaryKey === idOrName) {
          return tag;
        }
      }

      if (idOrName.includes('/')) {
        for (const tag of flattenedTags) {
          if (getTagPath(tag) === idOrName) {
            return tag;
          }
        }
        throw new Error("Tag not found: " + idOrName);
      }

      const matches = flattenedTags.filter(tag => tag.name === idOrName);

      if (matches.length === 0) {
        throw new Error("Tag not found: " + idOrName);
      }

      if (matches.length > 1) {
        const paths = matches.map(getTagPath);
        throw new Error("Multiple tags found with name '" + idOrName + "'. Please use full path:\\n  " + paths.join('\\n  ') + "\\nOr use tag ID: " + matches.map(t => t.id.primaryKey).join(', '));
      }

      return matches[0];
    }

    function findByName(collection, name, typeName) {
      for (const item of collection) {
        if (item.name === name) {
          return item;
        }
      }
      throw new Error(typeName + " not found: " + name);
    }

    function assignTags(target, tagNames) {
      for (const tagName of tagNames) {
        const tag = findTag(tagName);
        target.addTag(tag);
      }
    }

    function replaceTagsOn(target, tagNames) {
      target.clearTags();
      assignTags(target, tagNames);
    }

    function statusToString(status, StatusEnum) {
      if (status === StatusEnum.Active) return 'active';
      if (status === StatusEnum.OnHold) return 'on hold';
      if (status === StatusEnum.Dropped) return 'dropped';
      if (status === StatusEnum.Done) return 'done';
      return 'dropped';
    }

    function stringToStatus(str, StatusEnum) {
      if (str === 'active') return StatusEnum.Active;
      if (str === 'on hold') return StatusEnum.OnHold;
      return StatusEnum.Dropped;
    }

    const projectStatusToString = (status) => statusToString(status, Project.Status);
    const tagStatusToString = (status) => statusToString(status, Tag.Status);
    const folderStatusToString = (status) => {
      if (status === Folder.Status.Active) return 'active';
      return 'dropped';
    };
    const stringToProjectStatus = (str) => stringToStatus(str, Project.Status);
    const stringToTagStatus = (str) => stringToStatus(str, Tag.Status);

    function serializeFolder(folder, includeDropped = false) {
      let childFolders = folder.folders;
      if (!includeDropped) {
        childFolders = childFolders.filter(c => c.effectiveActive);
      }

      return {
        id: folder.id.primaryKey,
        name: folder.name,
        status: folderStatusToString(folder.status),
        effectivelyActive: folder.effectiveActive,
        parent: folder.parent ? folder.parent.name : null,
        projectCount: folder.projects.length,
        remainingProjectCount: folder.projects.filter(p => p.effectiveActive).length,
        folderCount: folder.folders.length,
        children: childFolders.map(child => serializeFolder(child, includeDropped))
      };
    }

    function computeTopItems(items, keyFn, topN = 5) {
      return items
        .sort((a, b) => b[keyFn] - a[keyFn])
        .slice(0, topN)
        .map(item => ({ name: item.name, [keyFn]: item[keyFn] }));
    }

    function computeAverage(total, count) {
      return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    }

    function serializeTag(tag, activeOnly = false) {
      const tasks = tag.tasks;
      const remainingTasks = tag.remainingTasks;
      const includedTasks = activeOnly ? remainingTasks : tasks;

      const dates = [];
      if (tag.added) dates.push(tag.added);
      if (tag.modified) dates.push(tag.modified);

      for (const task of includedTasks) {
        if (task.added) dates.push(task.added);
        if (task.modified) dates.push(task.modified);
        if (!activeOnly && task.completionDate) dates.push(task.completionDate);
        if (!activeOnly && task.effectiveCompletionDate) dates.push(task.effectiveCompletionDate);
      }

      const lastActivity = dates.length > 0
        ? dates.reduce((latest, current) => current > latest ? current : latest)
        : null;

      return {
        id: tag.id.primaryKey,
        name: tag.name,
        taskCount: includedTasks.length,
        remainingTaskCount: remainingTasks.length,
        added: tag.added ? tag.added.toISOString() : null,
        modified: tag.modified ? tag.modified.toISOString() : null,
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
        active: tag.active,
        status: tagStatusToString(tag.status),
        parent: tag.parent ? tag.parent.name : null,
        children: tag.children.map(c => c.name),
        allowsNextAction: tag.allowsNextAction
      };
    }
  `;

  private async executeJXA(script: string, timeoutMs = 30000): Promise<string> {
    const tmpFile = join(tmpdir(), `omnifocus-${Date.now()}.js`);

    try {
      await writeFile(tmpFile, script, 'utf-8');

      const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', tmpFile], {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });

      return stdout.trim();
    } finally {
      try {
        await unlink(tmpFile);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  private wrapOmniScript(omniScript: string): string {
    return `
      const app = Application('OmniFocus');
      app.includeStandardAdditions = true;
      const result = app.evaluateJavascript(${JSON.stringify(omniScript.trim())});
      result;
    `.trim();
  }

  private buildTaskFilters(filters: TaskFilters): string {
    const conditions: string[] = [];

    if (!filters.includeCompleted) {
      conditions.push('if (task.completed) continue;');
    }
    if (!filters.includeDropped) {
      conditions.push('if (!task.effectiveActive) continue;');
    }
    if (filters.flagged) {
      conditions.push('if (!task.flagged) continue;');
      conditions.push('if (task.taskStatus !== Task.Status.Available) continue;');
    }
    if (filters.project) {
      conditions.push(`
        if (!task.containingProject || task.containingProject.name !== "${this.escapeString(filters.project)}") {
          continue;
        }
      `);
    }
    if (filters.tag) {
      conditions.push(`
        if (!task.tags.some(t => t.name === "${this.escapeString(filters.tag)}")) {
          continue;
        }
      `);
    }

    return conditions.join('\n    ');
  }

  private buildProjectFilters(filters: ProjectFilters): string {
    const conditions: string[] = [];

    if (!filters.includeDropped) {
      conditions.push(
        'if (project.status === Project.Status.Dropped || project.status === Project.Status.Done) continue;'
      );
      conditions.push(
        'if (project.parentFolder && !project.parentFolder.effectiveActive) continue;'
      );
    }
    if (filters.status) {
      const statusCheck = this.PROJECT_STATUS_MAP[filters.status];
      conditions.push(`if (project.status !== Project.Status.${statusCheck}) continue;`);
    }
    if (filters.folder) {
      conditions.push(
        `if (!project.parentFolder || project.parentFolder.name !== "${this.escapeString(filters.folder)}") continue;`
      );
    }

    return conditions.join('\n    ');
  }

  private buildTaskUpdates(options: UpdateTaskOptions): string {
    const updates: string[] = [];

    if (options.name !== undefined) {
      updates.push(`task.name = "${this.escapeString(options.name)}";`);
    }
    if (options.note !== undefined) {
      updates.push(`task.note = "${this.escapeString(options.note)}";`);
    }
    if (options.flagged !== undefined) {
      updates.push(`task.flagged = ${options.flagged};`);
    }
    if (options.completed !== undefined) {
      updates.push(options.completed ? 'task.markComplete();' : 'task.markIncomplete();');
    }
    if (options.estimatedMinutes !== undefined) {
      updates.push(`task.estimatedMinutes = ${options.estimatedMinutes};`);
    }
    if (options.defer !== undefined) {
      updates.push(
        options.defer
          ? `task.deferDate = new Date(${JSON.stringify(options.defer)});`
          : 'task.deferDate = null;'
      );
    }
    if (options.due !== undefined) {
      updates.push(
        options.due
          ? `task.dueDate = new Date(${JSON.stringify(options.due)});`
          : 'task.dueDate = null;'
      );
    }
    if (options.project !== undefined && options.project) {
      updates.push(`
        const targetProject = findByName(flattenedProjects, "${this.escapeString(options.project)}", "Project");
        moveTasks([task], targetProject);
      `);
    }
    if (options.tags !== undefined) {
      updates.push(`replaceTagsOn(task, ${JSON.stringify(options.tags)});`);
    }

    return updates.join('\n    ');
  }

  private buildTagUpdates(options: UpdateTagOptions): string {
    const updates: string[] = [];

    if (options.name !== undefined) {
      updates.push(`tag.name = "${this.escapeString(options.name)}";`);
    }
    if (options.status !== undefined) {
      updates.push(`tag.status = stringToTagStatus("${options.status}");`);
    }

    return updates.join('\n    ');
  }

  private buildProjectUpdates(options: UpdateProjectOptions): string {
    const updates: string[] = [];

    if (options.name !== undefined) {
      updates.push(`project.name = "${this.escapeString(options.name)}";`);
    }
    if (options.note !== undefined) {
      updates.push(`project.note = "${this.escapeString(options.note)}";`);
    }
    if (options.sequential !== undefined) {
      updates.push(`project.sequential = ${options.sequential};`);
    }
    if (options.status !== undefined) {
      updates.push(`project.status = stringToProjectStatus("${options.status}");`);
    }
    if (options.folder !== undefined && options.folder) {
      updates.push(`
        const targetFolder = findByName(flattenedFolders, "${this.escapeString(options.folder)}", "Folder");
        moveProjects([project], targetFolder);
      `);
    }
    if (options.tags !== undefined) {
      updates.push(`replaceTagsOn(project, ${JSON.stringify(options.tags)});`);
    }

    return updates.join('\n    ');
  }

  async listTasks(filters: TaskFilters = {}): Promise<Task[]> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const results = [];
        for (const task of flattenedTasks) {
          ${this.buildTaskFilters(filters)}
          results.push(serializeTask(task));
        }
        return JSON.stringify(results);
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async createTask(options: CreateTaskOptions): Promise<Task> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        ${
          options.project
            ? `const targetProject = findByName(flattenedProjects, "${this.escapeString(options.project)}", "Project");
             const task = new Task("${this.escapeString(options.name)}", targetProject);`
            : `const task = new Task("${this.escapeString(options.name)}");`
        }

        ${options.note ? `task.note = "${this.escapeString(options.note)}";` : ''}
        ${options.flagged ? 'task.flagged = true;' : ''}
        ${options.estimatedMinutes ? `task.estimatedMinutes = ${options.estimatedMinutes};` : ''}
        ${options.defer ? `task.deferDate = new Date(${JSON.stringify(options.defer)});` : ''}
        ${options.due ? `task.dueDate = new Date(${JSON.stringify(options.due)});` : ''}
        ${options.tags && options.tags.length > 0 ? `assignTags(task, ${JSON.stringify(options.tags)});` : ''}

        return JSON.stringify(serializeTask(task));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async updateTask(idOrName: string, options: UpdateTaskOptions): Promise<Task> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const task = findTask("${this.escapeString(idOrName)}");
        ${this.buildTaskUpdates(options)}
        return JSON.stringify(serializeTask(task));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async deleteTask(idOrName: string): Promise<void> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        deleteObject(findTask("${this.escapeString(idOrName)}"));
      })();
    `;

    await this.executeJXA(this.wrapOmniScript(omniScript));
  }

  async listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
    const filterCode = this.buildProjectFilters(filters);
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const results = [];
        for (const project of flattenedProjects) {
          ${filterCode}
          results.push(serializeProject(project));
        }
        return JSON.stringify(results);
      })();
    `;
    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async createProject(options: CreateProjectOptions): Promise<Project> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        ${
          options.folder
            ? `const targetFolder = findByName(flattenedFolders, "${this.escapeString(options.folder)}", "Folder");
             const project = new Project("${this.escapeString(options.name)}", targetFolder);`
            : `const project = new Project("${this.escapeString(options.name)}");`
        }

        ${options.note ? `project.note = "${this.escapeString(options.note)}";` : ''}
        ${options.sequential !== undefined ? `project.sequential = ${options.sequential};` : ''}
        ${options.status ? `project.status = stringToProjectStatus("${options.status}");` : ''}
        ${options.tags && options.tags.length > 0 ? `assignTags(project, ${JSON.stringify(options.tags)});` : ''}

        return JSON.stringify(serializeProject(project));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async updateProject(idOrName: string, options: UpdateProjectOptions): Promise<Project> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const project = findProject("${this.escapeString(idOrName)}");
        ${this.buildProjectUpdates(options)}
        return JSON.stringify(serializeProject(project));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async deleteProject(idOrName: string): Promise<void> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        deleteObject(findProject("${this.escapeString(idOrName)}"));
      })();
    `;

    await this.executeJXA(this.wrapOmniScript(omniScript));
  }

  async listInboxTasks(): Promise<Task[]> {
    return this.getPerspectiveTasks('Inbox');
  }

  async getInboxCount(): Promise<number> {
    const tasks = await this.getPerspectiveTasks('Inbox');
    return tasks.length;
  }

  async searchTasks(query: string): Promise<Task[]> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const results = [];
        const searchQuery = "${this.escapeString(query)}".toLowerCase();

        for (const task of flattenedTasks) {
          if (task.completed) continue;
          if (!task.effectiveActive) continue;

          const name = task.name.toLowerCase();
          const note = (task.note || '').toLowerCase();

          if (name.includes(searchQuery) || note.includes(searchQuery)) {
            results.push(serializeTask(task));
          }
        }

        return JSON.stringify(results);
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async getTask(idOrName: string): Promise<Task> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const task = findTask("${this.escapeString(idOrName)}");
        return JSON.stringify(serializeTask(task));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async getProject(idOrName: string): Promise<Project> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const project = findProject("${this.escapeString(idOrName)}");
        return JSON.stringify(serializeProject(project));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async listPerspectives(): Promise<Perspective[]> {
    const omniScript = `
      (() => {
        const results = [];

        const builtInNames = ['Inbox', 'Flagged', 'Forecast', 'Projects', 'Tags', 'Nearby', 'Review'];
        for (const name of builtInNames) {
          results.push({ id: name, name: name });
        }

        const customPerspectives = Perspective.Custom.all;
        for (const perspective of customPerspectives) {
          results.push({ id: perspective.name, name: perspective.name });
        }

        return JSON.stringify(results);
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async getPerspectiveTasks(perspectiveName: string): Promise<Task[]> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const doc = document;
        const windows = doc.windows;

        if (windows.length === 0) {
          throw new Error("No OmniFocus window is open. Please open an OmniFocus window and try again.");
        }

        const win = windows[0];
        const perspectiveName = "${this.escapeString(perspectiveName)}";

        const builtInPerspectives = {
          'inbox': Perspective.BuiltIn.Inbox,
          'flagged': Perspective.BuiltIn.Flagged,
          'forecast': Perspective.BuiltIn.Forecast,
          'projects': Perspective.BuiltIn.Projects,
          'tags': Perspective.BuiltIn.Tags,
          'nearby': Perspective.BuiltIn.Nearby,
          'review': Perspective.BuiltIn.Review
        };

        const lowerName = perspectiveName.toLowerCase();
        if (builtInPerspectives[lowerName]) {
          win.perspective = builtInPerspectives[lowerName];
        } else {
          const customPerspective = Perspective.Custom.byName(perspectiveName);
          if (customPerspective) {
            win.perspective = customPerspective;
          } else {
            throw new Error("Perspective not found: " + perspectiveName);
          }
        }

        const content = win.content;
        if (!content) {
          throw new Error("No content available in window");
        }

        const tasks = [];
        content.rootNode.apply(node => {
          const obj = node.object;
          if (obj instanceof Task) {
            tasks.push(serializeTask(obj));
          }
        });

        return JSON.stringify(tasks);
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript), 60000);
    return JSON.parse(output);
  }

  async listTags(options: TagListOptions = {}): Promise<Tag[]> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const results = [];
        const now = new Date();
        const activeOnly = ${!!options.activeOnly};

        for (const tag of flattenedTags) {
          const serialized = serializeTag(tag, activeOnly);
          results.push(serialized);
        }

        ${
          options.unusedDays
            ? `
          const cutoffDate = new Date(now.getTime() - (${options.unusedDays} * 24 * 60 * 60 * 1000));
          const filtered = results.filter(tag => {
            if (!tag.lastActivity) return true;
            return new Date(tag.lastActivity) < cutoffDate;
          });
          return JSON.stringify(filtered);
        `
            : 'return JSON.stringify(results);'
        }
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    const tags = JSON.parse(output);

    return this.sortTags(tags, options.sortBy);
  }

  private sortTags(tags: Tag[], sortBy: string = 'name'): Tag[] {
    const sortFns: Record<string, (a: Tag, b: Tag) => number> = {
      usage: (a, b) => b.taskCount - a.taskCount,
      activity: (a, b) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      },
      name: (a, b) => a.name.localeCompare(b.name),
    };

    return tags.sort(sortFns[sortBy] || sortFns.name);
  }

  async getTagStats(): Promise<TagStats> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const allTags = [];
        for (const tag of flattenedTags) {
          allTags.push(serializeTag(tag));
        }

        const activeTags = allTags.filter(t => t.active);
        const tagsWithTasks = allTags.filter(t => t.taskCount > 0);
        const unusedTags = allTags.filter(t => t.taskCount === 0);

        const totalTasks = tagsWithTasks.reduce((sum, t) => sum + t.taskCount, 0);
        const avgTasksPerTag = computeAverage(totalTasks, tagsWithTasks.length);

        const mostUsedTags = computeTopItems(allTags, 'taskCount');
        const leastUsedTags = computeTopItems(
          tagsWithTasks.map(t => ({ ...t, taskCount: -t.taskCount })),
          'taskCount'
        ).map(t => ({ name: t.name, taskCount: -t.taskCount }));

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const staleTags = allTags
          .filter(t => t.lastActivity && new Date(t.lastActivity) < thirtyDaysAgo)
          .map(t => ({
            name: t.name,
            daysSinceActivity: Math.floor((now - new Date(t.lastActivity)) / (24 * 60 * 60 * 1000))
          }))
          .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

        return JSON.stringify({
          totalTags: allTags.length,
          activeTags: activeTags.length,
          tagsWithTasks: tagsWithTasks.length,
          unusedTags: unusedTags.length,
          avgTasksPerTag,
          mostUsedTags,
          leastUsedTags,
          staleTags
        });
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async createTag(options: CreateTagOptions): Promise<Tag> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        ${
          options.parent
            ? `const parentTag = findTag("${this.escapeString(options.parent)}");
             const tag = new Tag("${this.escapeString(options.name)}", parentTag);`
            : `const tag = new Tag("${this.escapeString(options.name)}", tags.beginning);`
        }

        ${options.status ? `tag.status = stringToTagStatus("${options.status}");` : ''}

        return JSON.stringify(serializeTag(tag));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async getTag(idOrName: string): Promise<Tag> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const tag = findTag("${this.escapeString(idOrName)}");
        return JSON.stringify(serializeTag(tag));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async updateTag(idOrName: string, options: UpdateTagOptions): Promise<Tag> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const tag = findTag("${this.escapeString(idOrName)}");
        ${this.buildTagUpdates(options)}
        return JSON.stringify(serializeTag(tag));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async deleteTag(idOrName: string): Promise<void> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        deleteObject(findTag("${this.escapeString(idOrName)}"));
      })();
    `;

    await this.executeJXA(this.wrapOmniScript(omniScript));
  }

  async getTaskStats(): Promise<TaskStats> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const allTasks = Array.from(flattenedTasks);
        const now = new Date();

        const activeTasks = allTasks.filter(t => !t.completed && t.effectiveActive);
        const completedTasks = allTasks.filter(t => t.completed);
        const flaggedTasks = activeTasks.filter(t => t.flagged);
        const overdueActiveTasks = activeTasks.filter(t => t.dueDate && t.dueDate < now);

        const tasksWithEstimates = allTasks.filter(t => t.estimatedMinutes && t.estimatedMinutes > 0);
        const totalEstimatedMinutes = tasksWithEstimates.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
        const avgEstimatedMinutes = tasksWithEstimates.length > 0
          ? Math.round(totalEstimatedMinutes / tasksWithEstimates.length)
          : null;

        const totalNonDropped = allTasks.filter(t => t.effectiveActive || t.completed).length;
        const completionRate = totalNonDropped > 0
          ? Math.round((completedTasks.length / totalNonDropped) * 100)
          : 0;

        const projectCounts = {};
        for (const task of allTasks) {
          if (!task.effectiveActive && !task.completed) continue;
          const projectName = task.containingProject ? task.containingProject.name : 'Inbox';
          projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;
        }
        const tasksByProject = computeTopItems(
          Object.entries(projectCounts).map(([name, count]) => ({ name, taskCount: count })),
          'taskCount'
        );

        const tagCounts = {};
        for (const task of allTasks) {
          if (!task.effectiveActive && !task.completed) continue;
          for (const tag of task.tags) {
            tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
          }
        }
        const tasksByTag = computeTopItems(
          Object.entries(tagCounts).map(([name, count]) => ({ name, taskCount: count })),
          'taskCount'
        );

        return JSON.stringify({
          totalTasks: allTasks.length,
          activeTasks: activeTasks.length,
          completedTasks: completedTasks.length,
          flaggedTasks: flaggedTasks.length,
          overdueActiveTasks: overdueActiveTasks.length,
          avgEstimatedMinutes,
          tasksWithEstimates: tasksWithEstimates.length,
          completionRate,
          tasksByProject,
          tasksByTag
        });
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async getProjectStats(): Promise<ProjectStats> {
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const allProjects = Array.from(flattenedProjects);

        function isProjectEffectivelyActive(p) {
          if (p.status === Project.Status.Dropped || p.status === Project.Status.Done) return false;
          if (p.parentFolder && !p.parentFolder.effectiveActive) return false;
          return true;
        }

        const effectivelyActiveProjects = allProjects.filter(isProjectEffectivelyActive);
        const activeProjects = effectivelyActiveProjects.filter(p => p.status === Project.Status.Active);
        const onHoldProjects = effectivelyActiveProjects.filter(p => p.status === Project.Status.OnHold);
        const droppedProjects = allProjects.filter(p => p.status === Project.Status.Dropped);
        const doneProjects = allProjects.filter(p => p.status === Project.Status.Done);
        const sequentialProjects = effectivelyActiveProjects.filter(p => p.sequential);
        const parallelProjects = effectivelyActiveProjects.filter(p => !p.sequential);

        const totalTasks = effectivelyActiveProjects.reduce((sum, p) => sum + p.flattenedTasks.length, 0);
        const totalRemaining = effectivelyActiveProjects.reduce((sum, p) => {
          return sum + p.flattenedTasks.filter(t => !t.completed).length;
        }, 0);

        const avgTasksPerProject = computeAverage(totalTasks, effectivelyActiveProjects.length);
        const avgRemainingPerProject = computeAverage(totalRemaining, effectivelyActiveProjects.length);

        const completionRates = effectivelyActiveProjects
          .filter(p => p.flattenedTasks.length > 0)
          .map(p => {
            const total = p.flattenedTasks.length;
            const completed = p.flattenedTasks.filter(t => t.completed).length;
            return (completed / total) * 100;
          });

        const avgCompletionRate = completionRates.length > 0
          ? Math.round(completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length)
          : 0;

        const projectsWithMostTasks = computeTopItems(
          effectivelyActiveProjects.map(p => ({ name: p.name, taskCount: p.flattenedTasks.length })),
          'taskCount'
        );

        const projectsWithMostRemaining = computeTopItems(
          effectivelyActiveProjects
            .map(p => ({ name: p.name, remainingCount: p.flattenedTasks.filter(t => !t.completed).length }))
            .filter(p => p.remainingCount > 0),
          'remainingCount'
        );

        return JSON.stringify({
          totalProjects: allProjects.length,
          activeProjects: activeProjects.length,
          onHoldProjects: onHoldProjects.length,
          droppedProjects: droppedProjects.length,
          doneProjects: doneProjects.length,
          sequentialProjects: sequentialProjects.length,
          parallelProjects: parallelProjects.length,
          avgTasksPerProject,
          avgRemainingPerProject,
          avgCompletionRate,
          projectsWithMostTasks,
          projectsWithMostRemaining
        });
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async listFolders(filters: FolderFilters = {}): Promise<Folder[]> {
    const includeDropped = filters.includeDropped ?? false;
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const includeDropped = ${includeDropped};
        const results = [];
        for (const folder of folders) {
          if (!includeDropped && !folder.effectiveActive) continue;
          results.push(serializeFolder(folder, includeDropped));
        }
        return JSON.stringify(results);
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }

  async getFolder(idOrName: string, filters: FolderFilters = {}): Promise<Folder> {
    const includeDropped = filters.includeDropped ?? false;
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const includeDropped = ${includeDropped};

        function findFolder(idOrName) {
          for (const folder of flattenedFolders) {
            if (folder.id.primaryKey === idOrName || folder.name === idOrName) {
              return folder;
            }
          }
          throw new Error("Folder not found: " + idOrName);
        }

        const folder = findFolder("${this.escapeString(idOrName)}");
        return JSON.stringify(serializeFolder(folder, includeDropped));
      })();
    `;

    const output = await this.executeJXA(this.wrapOmniScript(omniScript));
    return JSON.parse(output);
  }
}
