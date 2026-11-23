import { z } from 'zod';
import { OmniFocusCliError } from './errors.js';
import { parseDateTime } from './dates.js';

export const projectStatus = z.enum(['active', 'on hold', 'dropped', 'done']);
const tagStatus = z.enum(['active', 'on hold', 'dropped']);
const location = z.string().nullable().optional();
const date = z
  .string()
  .nullable()
  .optional()
  .transform((value) => (value ? parseDateTime(value) : value));
const taskFields = {
  name: z.string().optional(),
  note: z.string().optional(),
  project: location,
  tags: z.array(z.string()).optional(),
  defer: date,
  due: date,
  planned: date,
  flagged: z.boolean().optional(),
  estimatedMinutes: z.number().nonnegative().optional(),
};
const projectFields = {
  name: z.string().optional(),
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
export const taskCreate = z.strictObject({ ...taskFields, name: z.string().min(1) });
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
  .strictObject({ ...projectFields, name: z.string().min(1) })
  .superRefine(projectConflicts);
export const tagCreate = z.strictObject({
  name: z.string().min(1),
  parent: location,
  status: tagStatus.optional(),
});
export const tagUpdate = z.strictObject({
  name: z.string().optional(),
  status: tagStatus.optional(),
  parent: location,
  parentId: location,
});

export function parseMutation<T extends z.ZodType>(
  schema: T,
  input: unknown,
  update = false
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new OmniFocusCliError(`Invalid arguments: ${result.error.message}`, 400);
  if (update && !Object.values(result.data as object).some((value) => value !== undefined)) {
    throw new OmniFocusCliError('An update requires at least one supported change', 400);
  }
  return result.data;
}
