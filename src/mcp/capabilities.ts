export type CapabilityMode = 'full' | 'read-only';

/** Read-only mode registers a tool only when the tool declares itself safe for it. */
export function isAvailable(tool: { readOnly: boolean }, mode: CapabilityMode): boolean {
  return mode === 'full' || tool.readOnly;
}
