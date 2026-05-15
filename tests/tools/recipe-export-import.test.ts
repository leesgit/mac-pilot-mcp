import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PilotDatabase, createTestDatabase } from '../../src/db/database.js';

vi.mock('../../src/recipes/builtin.js', () => ({
  // Use a tiny built-in set in tests so `includeBuiltins:false` is easy to verify.
  BUILTIN_RECIPES: [
    {
      name: 'builtin-toggle-dark-mode',
      description: 'built-in toggle',
      steps: [{ actionType: 'applescript', params: { script: 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode' }, description: 'Toggle' }],
      tags: ['system'],
    },
  ],
}));

const { handleRecipeExport } = await import('../../src/tools/recipe-export.js');
const { handleRecipeImport } = await import('../../src/tools/recipe-import.js');

let db: PilotDatabase;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  db.close();
});

function getText(result: ReturnType<typeof handleRecipeExport>): string {
  return (result.content[0] as { text: string }).text;
}

describe('mac_recipe_export', () => {
  it('exports a single recipe by name', () => {
    db.saveRecipe({
      name: 'user-recipe-1',
      description: 'first user recipe',
      steps: JSON.stringify([{ actionType: 'shell', params: { command: 'ls' }, description: 'ls' }]),
      tags: JSON.stringify(['shell']),
    });

    const result = handleRecipeExport({ name: 'user-recipe-1' }, db);
    const text = getText(result);
    const bundle = JSON.parse(text);
    expect(bundle.format).toBe('mac-recipe-bundle/v1');
    expect(bundle.recipes).toHaveLength(1);
    expect(bundle.recipes[0].name).toBe('user-recipe-1');
  });

  it('errors on missing recipe', () => {
    const result = handleRecipeExport({ name: 'does-not-exist' }, db);
    expect(result.isError).toBe(true);
  });

  it('exports only user recipes by default', () => {
    // Built-in recipe also gets stored when an integration loads it; simulate that here.
    db.saveRecipe({
      name: 'builtin-toggle-dark-mode',
      description: 'built-in toggle',
      steps: JSON.stringify([]),
    });
    db.saveRecipe({
      name: 'user-recipe-1',
      description: 'mine',
      steps: JSON.stringify([]),
    });

    const result = handleRecipeExport({}, db);
    const bundle = JSON.parse(getText(result));
    expect(bundle.recipes.map((r: { name: string }) => r.name)).toEqual(['user-recipe-1']);
  });

  it('includes built-ins when asked', () => {
    db.saveRecipe({ name: 'builtin-toggle-dark-mode', description: 'b', steps: '[]' });
    db.saveRecipe({ name: 'user-recipe-1', description: 'm', steps: '[]' });

    const result = handleRecipeExport({ includeBuiltins: true }, db);
    const bundle = JSON.parse(getText(result));
    expect(bundle.recipes.map((r: { name: string }) => r.name).sort()).toEqual(['builtin-toggle-dark-mode', 'user-recipe-1']);
  });

  it('rejects outputPath outside HOME', () => {
    const result = handleRecipeExport({ outputPath: '/etc/passwd' }, db);
    expect(result.isError).toBe(true);
  });

  it('rejects outputPath without .json extension', () => {
    const result = handleRecipeExport({ outputPath: '~/recipes/dump.txt' }, db);
    expect(result.isError).toBe(true);
  });
});

describe('mac_recipe_import', () => {
  const validBundle = {
    format: 'mac-recipe-bundle/v1' as const,
    exportedAt: new Date().toISOString(),
    recipes: [
      {
        name: 'imported-1',
        description: 'imported',
        steps: [{ actionType: 'shell' as const, params: { command: 'ls' }, description: 'ls' }],
      },
    ],
  };

  it('imports a fresh bundle', () => {
    const result = handleRecipeImport({ bundle: validBundle }, db);
    const summary = JSON.parse(getText(result));
    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(db.getRecipe('imported-1')).toBeDefined();
  });

  it('skips on conflict by default', () => {
    db.saveRecipe({ name: 'imported-1', description: 'pre-existing', steps: '[]' });
    const result = handleRecipeImport({ bundle: validBundle }, db);
    const summary = JSON.parse(getText(result));
    expect(summary.imported).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(db.getRecipe('imported-1')?.description).toBe('pre-existing');
  });

  it('renames on conflict when asked', () => {
    db.saveRecipe({ name: 'imported-1', description: 'pre-existing', steps: '[]' });
    const result = handleRecipeImport({ bundle: validBundle, onConflict: 'rename' }, db);
    const summary = JSON.parse(getText(result));
    expect(summary.renamed).toBe(1);
    expect(db.getRecipe('imported-1-imported-1')).toBeDefined();
    expect(db.getRecipe('imported-1')?.description).toBe('pre-existing');
  });

  it('replaces on conflict when asked', () => {
    db.saveRecipe({ name: 'imported-1', description: 'pre-existing', steps: '[]' });
    const result = handleRecipeImport({ bundle: validBundle, onConflict: 'replace' }, db);
    const summary = JSON.parse(getText(result));
    expect(summary.replaced).toBe(1);
    expect(db.getRecipe('imported-1')?.description).toBe('imported');
  });

  it('rejects unknown format version', () => {
    const result = handleRecipeImport({
      bundle: { ...validBundle, format: 'mac-recipe-bundle/v99' } as unknown as typeof validBundle,
    }, db);
    expect(result.isError).toBe(true);
  });

  it('requires bundle xor inputPath', () => {
    const result = handleRecipeImport({}, db);
    expect(result.isError).toBe(true);
  });
});
