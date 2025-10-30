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
  Perspective,
} from '../types.js';

const execFileAsync = promisify(execFile);

export class OmniFocus {
  private readonly PROJECT_STATUS_MAP = {
    'active': 'Active',
    'on hold': 'OnHold',
    'dropped': 'Dropped'
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
        flagged: task.flagged,
        project: containingProject ? containingProject.name : null,
        tags: tagNames,
        defer: task.deferDate ? task.deferDate.toISOString() : null,
        due: task.dueDate ? task.dueDate.toISOString() : null,
        estimatedMinutes: task.estimatedMinutes || null,
        completionDate: task.completionDate ? task.completionDate.toISOString() : null
      };
    }

    function serializeProject(project) {
      const folder = project.folder;
      const allTasks = project.flattenedTasks;
      const remainingTasks = allTasks.filter(t => !t.completed);
      const tagNames = project.tags.map(t => t.name);

      return {
        id: project.id.primaryKey,
        name: project.name,
        note: project.note || null,
        status: projectStatusToString(project.status),
        folder: folder ? folder.name : null,
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
        const tag = findByName(flattenedTags, tagName, "Tag");
        target.addTag(tag);
      }
    }

    function replaceTagsOn(target, tagNames) {
      target.clearTags();
      assignTags(target, tagNames);
    }

    function projectStatusToString(status) {
      if (status === Project.Status.Active) return 'active';
      if (status === Project.Status.OnHold) return 'on hold';
      return 'dropped';
    }

    function stringToProjectStatus(str) {
      if (str === 'active') return Project.Status.Active;
      if (str === 'on hold') return Project.Status.OnHold;
      return Project.Status.Dropped;
    }
  `;

  private async executeJXA(script: string, timeoutMs = 30000): Promise<string> {
    const tmpFile = join(tmpdir(), `omnifocus-${Date.now()}.js`);

    try {
      await writeFile(tmpFile, script, 'utf-8');

      const { stdout, stderr } = await execFileAsync(
        'osascript',
        ['-l', 'JavaScript', tmpFile],
        {
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      if (stderr) {
        console.error('JXA stderr:', stderr);
      }

      return stdout.trim();
    } finally {
      try {
        await unlink(tmpFile);
      } catch (error) {
        // Temporary file cleanup is non-critical and safe to ignore
      }
    }
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
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
      conditions.push('if (task.dropped) continue;');
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
      conditions.push('if (project.status === Project.Status.Dropped) continue;');
    }
    if (filters.status) {
      const statusCheck = this.PROJECT_STATUS_MAP[filters.status];
      conditions.push(`if (project.status !== Project.Status.${statusCheck}) continue;`);
    }
    if (filters.folder) {
      conditions.push(`
        if (!project.folder || project.folder.name !== "${this.escapeString(filters.folder)}") {
          continue;
        }
      `);
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
      updates.push(`task.completed = ${options.completed};`);
    }
    if (options.estimatedMinutes !== undefined) {
      updates.push(`task.estimatedMinutes = ${options.estimatedMinutes};`);
    }
    if (options.defer !== undefined) {
      updates.push(options.defer
        ? `task.deferDate = new Date("${options.defer}");`
        : 'task.deferDate = null;'
      );
    }
    if (options.due !== undefined) {
      updates.push(options.due
        ? `task.dueDate = new Date("${options.due}");`
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
        ${options.project
          ? `const targetProject = findByName(flattenedProjects, "${this.escapeString(options.project)}", "Project");
             const task = new Task("${this.escapeString(options.name)}", targetProject);`
          : `const task = new Task("${this.escapeString(options.name)}", inbox);`
        }

        ${options.note ? `task.note = "${this.escapeString(options.note)}";` : ''}
        ${options.flagged ? 'task.flagged = true;' : ''}
        ${options.estimatedMinutes ? `task.estimatedMinutes = ${options.estimatedMinutes};` : ''}
        ${options.defer ? `task.deferDate = new Date("${options.defer}");` : ''}
        ${options.due ? `task.dueDate = new Date("${options.due}");` : ''}
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
    const omniScript = `
      ${this.OMNI_HELPERS}
      (() => {
        const results = [];
        for (const project of flattenedProjects) {
          ${this.buildProjectFilters(filters)}
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
        ${options.folder
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
          if (task.dropped) continue;

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
}
