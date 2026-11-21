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

export interface PerspectiveRulesResult {
  id: string;
  name: string;
  definition: PerspectiveRulesDefinition;
}

export function parsePerspectiveRules(input: unknown): PerspectiveRulesDefinition {
  const result = perspectiveRulesSchema.safeParse(input);
  if (!result.success) {
    throw new OmniFocusCliError(`Invalid perspective rules: ${result.error.message}`, 400);
  }
  return result.data;
}

export const PERSPECTIVE_RULES_HELPERS = `
  function findCustomPerspective(idOrName) {
    const byId = Perspective.Custom.byIdentifier(idOrName);
    if (byId) return byId;
    const matches = Perspective.Custom.all.filter(p => p.name === idOrName);
    if (matches.length > 1) throw new Error('Multiple perspectives named: ' + idOrName + '. Use an identifier.');
    if (matches.length === 1) return matches[0];
    const builtInNames = ['inbox', 'flagged', 'forecast', 'projects', 'tags', 'nearby', 'review', 'search', 'completed', 'changed'];
    if (builtInNames.includes(idOrName.toLowerCase()) ||
        Perspective.BuiltIn.all.some(p => p.name === idOrName)) {
      throw new Error('Built-in perspective has no editable rules: ' + idOrName);
    }
    throw new Error('Perspective not found: ' + idOrName);
  }

  function readPerspectiveRules(perspective) {
    const definition = {
      archivedFilterRules: perspective.archivedFilterRules,
      archivedTopLevelFilterAggregation: perspective.archivedTopLevelFilterAggregation
    };
    if (!Array.isArray(definition.archivedFilterRules) ||
        ![null, 'all', 'any', 'none'].includes(definition.archivedTopLevelFilterAggregation)) {
      throw new Error('OmniFocus returned an unsupported perspective rules archive');
    }
    return JSON.parse(JSON.stringify(definition));
  }

  function canonicalRules(value) {
    if (Array.isArray(value)) return '[' + value.map(canonicalRules).join(',') + ']';
    if (value !== null && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalRules(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
  }
`;
