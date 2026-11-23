import { fakeDatabase } from './fake-database.js';

// A small seeded database for the mock osascript executable. Each CLI run
// loads it afresh, so writes do not carry over between runs.
const database = fakeDatabase();
const { Folder, Project, Tag, Task } = database;

const project = new Project('Seeded project', new Folder('Seeded folder'));
const task = new Task('Seeded task', project);
task.addTag(new Tag('Seeded tag'));
new Task('Seeded inbox task');
database.perspectives.push({
  identifier: 'seeded-perspective',
  name: 'Seeded perspective',
  archivedFilterRules: [{ actionAvailability: 'available' }],
  archivedTopLevelFilterAggregation: 'all',
});
database.frontWindow.visibleTasks = [task];

export const context = database.context;
