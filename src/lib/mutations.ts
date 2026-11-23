import { z } from 'zod';
import { OmniFocusCliError } from './errors.js';
import { parseDateTime } from './dates.js';

export const projectStatus = z.enum(['active', 'on hold', 'dropped', 'done']);
const tagStatus = z.enum(['active', 'on hold', 'dropped']);
const location = z.string().nullable().optional();
const name = z.string().min(1);
const date = z
  .string()
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return value;
    try {
      return parseDateTime(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: `Invalid date: ${value}` });
      return z.NEVER;
    }
  });
const taskFields = {
  name: name.optional(),
  note: z.string().optional(),
  project: location,
  tags: z.array(z.string()).optional(),
  defer: date,
  due: date,
  planned: date,
  flagged: z.boolean().optional(),
  estimatedMinutes: z.number().int().nonnegative().optional(),
};
const projectFields = {
  name: name.optional(),
  note: z.string().optional(),
  folder: location,
  sequential: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  status: projectStatus.optional(),
  type: z.enum(['parallel', 'sequential', 'single-action']).optional(),
  singleActionList: z.boolean().optional(),
};
function projectConflicts(value: z.infer<typeof projectUpdate>, ctx: z.RefinementCtx) {
  if (
    value.completed !== undefined &&
    value.status !== undefined &&
    value.status !== (value.completed ? 'done' : 'active')
  ) {
    ctx.addIssue({ code: 'custom', message: 'Conflicting status and completed arguments' });
  }
  if (
    (value.type !== undefined &&
      value.singleActionList !== undefined &&
      value.singleActionList !== (value.type === 'single-action')) ||
    (value.type !== undefined &&
      value.sequential !== undefined &&
      value.sequential !== (value.type === 'sequential')) ||
    (value.singleActionList === true && value.sequential === true)
  ) {
    ctx.addIssue({ code: 'custom', message: 'Conflicting project type arguments' });
  }
}
export const taskCreate = z.strictObject({ ...taskFields, name });
export const taskUpdate = z
  .strictObject({
    ...taskFields,
    completed: z.boolean().optional(),
    dropped: z.boolean().optional(),
    before: z.string().min(1).optional(),
    after: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.before !== undefined && value.after !== undefined) ||
      ((value.before !== undefined || value.after !== undefined) &&
        (value.project !== undefined ||
          value.completed !== undefined ||
          value.dropped !== undefined))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Ordering cannot combine before/after or project/completed/dropped arguments',
      });
    }
  });
const projectUpdate = z.strictObject({ ...projectFields, completed: z.boolean().optional() });
export const projectMutation = projectUpdate.superRefine(projectConflicts);
export const projectCreate = z
  .strictObject({ ...projectFields, name })
  .superRefine(projectConflicts);
export const tagCreate = z.strictObject({
  name,
  parent: location,
  status: tagStatus.optional(),
});
export const tagUpdate = z.strictObject({
  name: name.optional(),
  status: tagStatus.optional(),
  parent: location,
  parentId: location,
});
export const folderCreate = z.strictObject({
  name: name.describe('Top-level folder name (exact match)'),
});

// Read arguments. The MCP tools and the library parse the same schemas, so a
// filter the CLI passes is checked exactly as a tool argument is.
export const taskFilters = z.strictObject({
  includeCompleted: z.boolean().optional().describe('Include completed tasks'),
  includeDropped: z.boolean().optional().describe('Include dropped tasks'),
  flagged: z
    .boolean()
    .optional()
    .describe('Only flagged tasks that are available: not blocked, deferred, or on hold'),
  project: z.string().nullable().optional().describe('Filter by project ID or unique name'),
  tag: z.string().optional().describe('Filter by tag ID, name, or path'),
});
export const projectFilters = z.strictObject({
  includeDropped: z.boolean().optional().describe('Include dropped projects'),
  status: projectStatus.optional().describe('Filter by status'),
  folder: z.string().nullable().optional().describe('Filter by folder ID or name'),
});
export const tagListOptions = z.strictObject({
  unusedDays: z
    .number()
    .nonnegative()
    .optional()
    .describe('Only show tags unused for this many days'),
  sortBy: z.enum(['name', 'usage', 'activity']).optional().describe('Sort order'),
  activeOnly: z.boolean().optional().describe('Only count active tasks'),
});
export const folderFilters = z.strictObject({
  includeDropped: z.boolean().optional().describe('Include dropped folders'),
});

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ` : '') + issue.message)
    .join('; ');
}

/** Parses arguments before OmniFocus is contacted, so a bad value never reaches a script. */
export function parseArguments<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new OmniFocusCliError(`Invalid arguments: ${describeIssues(result.error)}`, 400);
  }
  return result.data;
}

export function parseMutation<T extends z.ZodType>(
  schema: T,
  input: unknown,
  update = false
): z.output<T> {
  const data = parseArguments(schema, input);
  if (update && !Object.values(data as object).some((value) => value !== undefined)) {
    throw new OmniFocusCliError('An update requires at least one supported change', 400);
  }
  return data;
}
