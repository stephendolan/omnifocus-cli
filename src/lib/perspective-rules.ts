import { z } from 'zod';
import { OmniFocusCliError } from './errors.js';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValue),
    z.record(z.string(), jsonValue),
  ])
);
const aggregation = z.enum(['all', 'any', 'none']);
const rule: z.ZodType<Record<string, JsonValue>> = z.lazy(() =>
  z.record(z.string(), jsonValue).superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message: 'A rule must not be empty' });
    }
    if ('aggregateType' in value || 'aggregateRules' in value) {
      const group = z
        .object({ aggregateType: aggregation, aggregateRules: z.array(rule) })
        .safeParse(value);
      if (!group.success) {
        for (const issue of group.error.issues) {
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
        }
      }
    }
  })
);

const safeJsonKeys = z
  .strictObject({
    archivedFilterRules: z.unknown(),
    archivedTopLevelFilterAggregation: z.unknown(),
  })
  .superRefine((value, ctx) => {
    JSON.stringify(value, (key, item) => {
      if (key === '__proto__') {
        ctx.addIssue({ code: 'custom', message: 'The JSON key __proto__ is unsupported' });
      }
      return item;
    });
  });

export const perspectiveRulesSchema = z.intersection(
  safeJsonKeys,
  z.strictObject({
    archivedFilterRules: z.array(rule),
    archivedTopLevelFilterAggregation: aggregation.nullable(),
  })
);

export type PerspectiveRulesDefinition = z.infer<typeof perspectiveRulesSchema>;

export function parsePerspectiveRules(input: unknown): PerspectiveRulesDefinition {
  const result = perspectiveRulesSchema.safeParse(input);
  if (!result.success) {
    throw new OmniFocusCliError(`Invalid perspective rules: ${result.error.message}`, 400);
  }
  return result.data;
}
