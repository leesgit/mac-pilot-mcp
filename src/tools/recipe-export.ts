import * as fs from 'fs';
import * as path from 'path';
import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRecipeExportSchema } from '../schemas.js';
import type { PilotDatabase } from '../db/database.js';
import { BUILTIN_RECIPES } from '../recipes/builtin.js';

/**
 * Export saved recipes as a portable `.mac-recipe.json` bundle. Versioned
 * format (`mac-recipe-bundle/v1`) so future schema changes can fail loud at
 * import time instead of silently corrupting recipes.
 *
 * `includeBuiltins` is intentionally off by default: bundles are normally
 * meant to share *your* additions, not the recipes that come with the package.
 */
export function handleRecipeExport(
  args: Record<string, unknown>,
  db: PilotDatabase,
): CallToolResult {
  const parsed = MacRecipeExportSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { name, outputPath, includeBuiltins } = parsed.data;

  // Resolve which recipes to include.
  const recipes: Array<{
    name: string;
    description: string;
    app: string | null;
    steps: string;
    parameters: string | null;
    tags: string | null;
  }> = [];

  if (name) {
    const r = db.getRecipe(name);
    if (!r) return textResult(`Recipe "${name}" not found.`, true);
    recipes.push(r);
  } else {
    const builtinNames = new Set(BUILTIN_RECIPES.map(b => b.name));
    const rows = db.db.prepare('SELECT name, description, app, steps, parameters, tags FROM recipes').all() as Array<{
      name: string;
      description: string;
      app: string | null;
      steps: string;
      parameters: string | null;
      tags: string | null;
    }>;
    for (const r of rows) {
      if (!includeBuiltins && builtinNames.has(r.name)) continue;
      recipes.push(r);
    }
  }

  // Serialize each row's stored JSON columns back into structured form.
  const exported = recipes.map(r => {
    const out: Record<string, unknown> = {
      name: r.name,
      description: r.description,
      steps: JSON.parse(r.steps),
    };
    if (r.app) out.app = r.app;
    if (r.parameters) out.parameters = JSON.parse(r.parameters);
    if (r.tags) out.tags = JSON.parse(r.tags);
    return out;
  });

  const bundle = {
    format: 'mac-recipe-bundle/v1' as const,
    exportedAt: new Date().toISOString(),
    source: 'mac-pilot-mcp',
    recipes: exported,
  };

  // Inline return is the default; outputPath writes a file. The file path is
  // resolved against the user's home — we don't accept absolute paths into
  // system directories.
  if (outputPath) {
    const safePath = resolveSafePath(outputPath);
    if (!safePath) {
      return textResult('outputPath must resolve under $HOME and end with .json', true);
    }
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, JSON.stringify(bundle, null, 2), { mode: 0o600 });
    return textResult(JSON.stringify({
      written: safePath,
      recipes: bundle.recipes.length,
      format: bundle.format,
    }, null, 2));
  }

  return textResult(JSON.stringify(bundle, null, 2));
}

function resolveSafePath(input: string): string | null {
  if (!input.endsWith('.json')) return null;
  const home = process.env.HOME;
  if (!home) return null;
  // Expand `~/...`; reject absolute paths that escape $HOME.
  let p = input;
  if (p.startsWith('~/')) p = path.join(home, p.slice(2));
  const resolved = path.resolve(p);
  if (!resolved.startsWith(home)) return null;
  return resolved;
}
