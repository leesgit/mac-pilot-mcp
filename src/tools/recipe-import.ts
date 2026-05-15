import * as fs from 'fs';
import * as path from 'path';
import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRecipeImportSchema, RecipeBundleSchema } from '../schemas.js';
import type { PilotDatabase } from '../db/database.js';

/**
 * Import a `.mac-recipe.json` bundle. Accepts either an inline `bundle`
 * object or a path to a bundle file.
 *
 * Conflict policy:
 *   - `skip` (default): leave the existing recipe alone, increment skipped counter
 *   - `rename`: append `-imported-<n>` until the name is unique
 *   - `replace`: delete the existing row first
 *
 * The importer always validates the bundle against the v1 schema before
 * touching the DB — a malformed bundle fails fast with no partial writes.
 */
export function handleRecipeImport(
  args: Record<string, unknown>,
  db: PilotDatabase,
): CallToolResult {
  const parsed = MacRecipeImportSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { bundle: inlineBundle, inputPath, onConflict = 'skip' } = parsed.data;

  let bundle;
  if (inlineBundle) {
    bundle = inlineBundle;
  } else {
    if (!inputPath) {
      return textResult('Either `bundle` or `inputPath` is required.', true);
    }
    const safePath = resolveSafePath(inputPath);
    if (!safePath) return textResult('inputPath must resolve under $HOME and end with .json', true);
    if (!fs.existsSync(safePath)) return textResult(`File not found: ${safePath}`, true);

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(safePath, 'utf-8'));
    } catch (err) {
      return textResult(`Failed to parse bundle JSON: ${(err as Error).message}`, true);
    }
    const v = RecipeBundleSchema.safeParse(raw);
    if (!v.success) return textResult(`Bundle schema mismatch: ${v.error.message}`, true);
    bundle = v.data;
  }

  let imported = 0;
  let skipped = 0;
  let renamed = 0;
  let replaced = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (const r of bundle.recipes) {
    try {
      let targetName = r.name;
      const existing = db.getRecipe(targetName);
      if (existing) {
        if (onConflict === 'skip') {
          skipped++;
          continue;
        }
        if (onConflict === 'rename') {
          let n = 1;
          while (db.getRecipe(`${r.name}-imported-${n}`)) n++;
          targetName = `${r.name}-imported-${n}`;
          renamed++;
        }
        if (onConflict === 'replace') {
          db.db.prepare('DELETE FROM recipes WHERE name = ?').run(r.name);
          replaced++;
        }
      }
      db.saveRecipe({
        name: targetName,
        description: r.description,
        app: r.app ?? undefined,
        steps: JSON.stringify(r.steps),
        parameters: r.parameters ? JSON.stringify(r.parameters) : undefined,
        tags: r.tags ? JSON.stringify(r.tags) : undefined,
      });
      imported++;
    } catch (err) {
      errors.push({ name: r.name, error: (err as Error).message });
    }
  }

  return textResult(JSON.stringify({
    total: bundle.recipes.length,
    imported,
    skipped,
    renamed,
    replaced,
    errors,
  }, null, 2), errors.length > 0);
}

function resolveSafePath(input: string): string | null {
  if (!input.endsWith('.json')) return null;
  const home = process.env.HOME;
  if (!home) return null;
  let p = input;
  if (p.startsWith('~/')) p = path.join(home, p.slice(2));
  const resolved = path.resolve(p);
  if (!resolved.startsWith(home)) return null;
  return resolved;
}
