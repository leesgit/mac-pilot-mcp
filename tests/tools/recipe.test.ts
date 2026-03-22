import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, PilotDatabase } from '../../src/db/database.js';
import { AuditLogger } from '../../src/security/audit.js';
import * as childProcess from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const { handleRecipeSave } = await import('../../src/tools/recipe-save.js');
const { handleRecipeRun } = await import('../../src/tools/recipe-run.js');
const { handleRecipeSearch } = await import('../../src/tools/recipe-search.js');

let db: PilotDatabase;
let audit: AuditLogger;

beforeEach(() => {
  vi.restoreAllMocks();
  db = createTestDatabase();
  audit = new AuditLogger(db);
});

afterEach(() => {
  db.close();
});

describe('handleRecipeSave', () => {
  it('should save a valid recipe', () => {
    const result = handleRecipeSave({
      name: 'open-safari',
      description: 'Open Safari browser',
      app: 'Safari',
      steps: [
        { actionType: 'open', params: { target: 'Safari' }, description: 'Open Safari' },
      ],
      tags: ['browser'],
    }, db);

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.saved).toBe(true);
    expect(parsed.name).toBe('open-safari');
    expect(parsed.stepsCount).toBe(1);
  });

  it('should reject duplicate recipe name', () => {
    handleRecipeSave({
      name: 'test-recipe',
      description: 'test',
      steps: [{ actionType: 'open', params: { target: 'Safari' }, description: 'test' }],
    }, db);

    const result = handleRecipeSave({
      name: 'test-recipe',
      description: 'another test',
      steps: [{ actionType: 'open', params: { target: 'Finder' }, description: 'test' }],
    }, db);

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('already exists');
  });

  it('should reject invalid params', () => {
    const result = handleRecipeSave({
      name: '',
      description: 'test',
      steps: [],
    }, db);

    expect(result.isError).toBe(true);
  });
});

describe('handleRecipeRun', () => {
  it('should run a saved recipe', () => {
    // Save a recipe first
    db.saveRecipe({
      name: 'test-open',
      description: 'Test opening Safari',
      app: 'Safari',
      steps: JSON.stringify([
        { actionType: 'open', params: { target: 'Safari' }, description: 'Open Safari' },
      ]),
    });

    vi.mocked(childProcess.execSync).mockReturnValue('');

    const result = handleRecipeRun({ name: 'test-open' }, db, audit);

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);
    expect(parsed.stepsExecuted).toBe(1);

    // Stats should be updated
    const recipe = db.getRecipe('test-open');
    expect(recipe!.run_count).toBe(1);
    expect(recipe!.success_count).toBe(1);
  });

  it('should return error for nonexistent recipe', () => {
    const result = handleRecipeRun({ name: 'nonexistent' }, db, audit);
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('not found');
  });

  it('should substitute parameters', () => {
    db.saveRecipe({
      name: 'open-url',
      description: 'Open a URL',
      steps: JSON.stringify([
        { actionType: 'open', params: { target: '{{url}}' }, description: 'Open {{url}}' },
      ]),
      parameters: JSON.stringify([{ name: 'url', description: 'URL to open' }]),
    });

    vi.mocked(childProcess.execSync).mockReturnValue('');

    const result = handleRecipeRun(
      { name: 'open-url', params: { url: 'https://example.com' } },
      db,
      audit,
    );

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(true);

    // Verify the URL was substituted
    const call = vi.mocked(childProcess.execSync).mock.calls[0][0] as string;
    expect(call).toContain('https://example.com');
  });

  it('should support dryRun mode', () => {
    db.saveRecipe({
      name: 'dry-test',
      description: 'Dry run test',
      steps: JSON.stringify([
        { actionType: 'open', params: { target: 'Safari' }, description: 'Open Safari' },
        { actionType: 'shell', params: { command: 'echo hi' }, description: 'Echo' },
      ]),
    });

    const result = handleRecipeRun({ name: 'dry-test', dryRun: true }, db, audit);

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.stepsCount).toBe(2);

    // Nothing should be executed
    expect(childProcess.execSync).not.toHaveBeenCalled();
  });

  it('should stop on first failure', () => {
    db.saveRecipe({
      name: 'failing-recipe',
      description: 'Will fail on step 2',
      steps: JSON.stringify([
        { actionType: 'open', params: { target: 'Safari' }, description: 'Open Safari' },
        { actionType: 'shell', params: { command: 'sudo bad' }, description: 'Blocked step' },
        { actionType: 'open', params: { target: 'Finder' }, description: 'Should not execute' },
      ]),
    });

    vi.mocked(childProcess.execSync).mockReturnValue('');

    const result = handleRecipeRun({ name: 'failing-recipe' }, db, audit);

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.success).toBe(false);
    expect(parsed.stepsExecuted).toBe(2); // stopped at step 2
    expect(parsed.totalSteps).toBe(3);
  });
});

describe('handleRecipeSearch', () => {
  beforeEach(() => {
    db.saveRecipe({
      name: 'export-figma-png',
      description: 'Export current Figma frame as PNG',
      app: 'Figma',
      steps: '[]',
      tags: JSON.stringify(['figma', 'export']),
    });
    db.saveRecipe({
      name: 'open-browser',
      description: 'Open Safari browser',
      app: 'Safari',
      steps: '[]',
      tags: JSON.stringify(['browser']),
    });
  });

  it('should find recipes by query', () => {
    const result = handleRecipeSearch({ query: 'figma' }, db);

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.recipesFound).toBeGreaterThanOrEqual(1);
    expect(parsed.recipes[0].name).toBe('export-figma-png');
  });

  it('should filter by app', () => {
    const result = handleRecipeSearch({ query: 'export', app: 'Figma' }, db);

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.recipesFound).toBeGreaterThanOrEqual(1);
  });

  it('should include history when requested', () => {
    // Add some action history
    db.logAction({
      actionType: 'applescript',
      appContext: 'Figma',
      params: JSON.stringify({ script: 'tell app "Figma" to export' }),
      success: true,
    });

    const result = handleRecipeSearch(
      { query: 'Figma', includeHistory: true },
      db,
    );

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.historyFound).toBeGreaterThanOrEqual(1);
  });

  it('should return message for no results', () => {
    const result = handleRecipeSearch({ query: 'nonexistent_xyz' }, db);

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('No recipes or history found');
  });
});
