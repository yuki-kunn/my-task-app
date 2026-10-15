import { getItem, listAgenda } from './agenda.js';
import type { ToolDef, ToolScope } from './types.js';

// Registration order is the order clients see; keep it deterministic so the
// list is cacheable.
const ALL_TOOLS: readonly ToolDef[] = [listAgenda, getItem];

/** Tools visible to a token holding `granted` scopes (`write` implies `read`). */
export function toolsFor(granted: ReadonlySet<ToolScope>): ToolDef[] {
  return ALL_TOOLS.filter((t) => granted.has(t.scope));
}

export function toolPublicShape(t: ToolDef) {
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  };
}
