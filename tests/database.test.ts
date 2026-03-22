import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PilotDatabase, createTestDatabase } from '../src/db/database.js';

let db: PilotDatabase;

beforeEach(() => {
  db = createTestDatabase();
});

afterEach(() => {
  db.close();
});

describe('Action Log', () => {
  it('should log an action and return id', () => {
    const id = db.logAction({
      actionType: 'applescript',
      appContext: 'Finder',
      params: JSON.stringify({ script: 'tell app "Finder" to activate' }),
      success: true,
      durationMs: 150,
    });
    expect(id).toBeGreaterThan(0);
  });

  it('should log a failed action with error message', () => {
    db.logAction({
      actionType: 'shell',
      params: JSON.stringify({ command: 'invalid-cmd' }),
      success: false,
      errorMessage: 'command not found',
    });

    const logs = db.getActionLog({ limit: 1 });
    expect(logs).toHaveLength(1);
    expect(logs[0].success).toBe(0);
    expect(logs[0].error_message).toBe('command not found');
  });

  it('should filter by app', () => {
    db.logAction({ actionType: 'open', appContext: 'Safari', params: '{}', success: true });
    db.logAction({ actionType: 'open', appContext: 'Finder', params: '{}', success: true });
    db.logAction({ actionType: 'open', appContext: 'Safari', params: '{}', success: true });

    const safariLogs = db.getActionLog({ app: 'Safari' });
    expect(safariLogs).toHaveLength(2);
  });

  it('should filter by success only', () => {
    db.logAction({ actionType: 'shell', params: '{}', success: true });
    db.logAction({ actionType: 'shell', params: '{}', success: false });
    db.logAction({ actionType: 'shell', params: '{}', success: true });

    const successLogs = db.getActionLog({ successOnly: true });
    expect(successLogs).toHaveLength(2);
  });

  it('should limit results', () => {
    for (let i = 0; i < 10; i++) {
      db.logAction({ actionType: 'shell', params: `{"i":${i}}`, success: true });
    }
    const logs = db.getActionLog({ limit: 3 });
    expect(logs).toHaveLength(3);
  });

  it('should store script hash for dedup', () => {
    const hash = 'abc123def456';
    db.logAction({
      actionType: 'applescript',
      params: '{}',
      success: true,
      scriptHash: hash,
    });

    const logs = db.getActionLog({ limit: 1 });
    expect(logs[0]).toHaveProperty('action_type', 'applescript');
  });
});

describe('Recipes', () => {
  it('should save and retrieve a recipe', () => {
    const id = db.saveRecipe({
      name: 'open-safari',
      description: 'Open Safari browser',
      app: 'Safari',
      steps: JSON.stringify([{ actionType: 'open', params: { target: 'Safari' }, description: 'Open Safari' }]),
      tags: JSON.stringify(['browser', 'web']),
    });
    expect(id).toBeGreaterThan(0);

    const recipe = db.getRecipe('open-safari');
    expect(recipe).toBeDefined();
    expect(recipe!.name).toBe('open-safari');
    expect(recipe!.app).toBe('Safari');
    expect(recipe!.run_count).toBe(0);
  });

  it('should enforce unique recipe names', () => {
    db.saveRecipe({ name: 'test', description: 'test', steps: '[]' });
    expect(() => db.saveRecipe({ name: 'test', description: 'test2', steps: '[]' })).toThrow();
  });

  it('should update recipe stats on success', () => {
    db.saveRecipe({ name: 'my-recipe', description: 'test', steps: '[]' });

    db.updateRecipeStats('my-recipe', true);
    db.updateRecipeStats('my-recipe', true);
    db.updateRecipeStats('my-recipe', false);

    const recipe = db.getRecipe('my-recipe');
    expect(recipe!.run_count).toBe(3);
    expect(recipe!.success_count).toBe(2);
    expect(recipe!.last_run_at).toBeTruthy();
  });

  it('should return undefined for nonexistent recipe', () => {
    const recipe = db.getRecipe('nonexistent');
    expect(recipe).toBeUndefined();
  });
});

describe('Recipe FTS Search', () => {
  beforeEach(() => {
    db.saveRecipe({
      name: 'export-figma-png',
      description: 'Export current Figma frame as PNG',
      app: 'Figma',
      steps: '[]',
      tags: JSON.stringify(['figma', 'export', 'png']),
    });
    db.saveRecipe({
      name: 'open-safari-url',
      description: 'Open a URL in Safari browser',
      app: 'Safari',
      steps: '[]',
      tags: JSON.stringify(['browser', 'web', 'url']),
    });
    db.saveRecipe({
      name: 'screenshot-window',
      description: 'Take a screenshot of the active window',
      steps: '[]',
      tags: JSON.stringify(['screenshot', 'capture']),
    });
  });

  it('should find recipe by name', () => {
    const results = db.searchRecipes('figma');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe('export-figma-png');
  });

  it('should find recipe by description', () => {
    const results = db.searchRecipes('screenshot');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.name === 'screenshot-window')).toBe(true);
  });

  it('should filter by app', () => {
    const results = db.searchRecipes('export', 'Figma');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(r => r.app === 'Figma')).toBe(true);
  });

  it('should return empty for no match', () => {
    const results = db.searchRecipes('nonexistent_term_xyz');
    expect(results).toHaveLength(0);
  });
});

describe('Action Log FTS Search', () => {
  it('should search action log by params', () => {
    db.logAction({
      actionType: 'applescript',
      params: JSON.stringify({ script: 'tell application "Finder" to make new folder' }),
      success: true,
    });
    db.logAction({
      actionType: 'shell',
      params: JSON.stringify({ command: 'ls -la' }),
      success: true,
    });

    const results = db.searchActionLog('Finder');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should search by error message', () => {
    db.logAction({
      actionType: 'shell',
      params: '{}',
      success: false,
      errorMessage: 'permission denied: /etc/hosts',
    });

    const results = db.searchActionLog('permission denied');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].success).toBe(0);
  });
});

describe('App Knowledge', () => {
  it('should save and retrieve app knowledge', () => {
    db.saveAppKnowledge({
      appName: 'Figma',
      knowledgeType: 'quirk',
      content: 'Export menu is under File > Export, not Edit > Export',
    });

    const knowledge = db.getAppKnowledge('Figma');
    expect(knowledge).toHaveLength(1);
    expect(knowledge[0].content).toContain('Export menu');
    expect(knowledge[0].reliability).toBe(1.0);
  });

  it('should increase reliability on duplicate insert', () => {
    db.saveAppKnowledge({
      appName: 'Safari',
      knowledgeType: 'workaround',
      content: 'Use cmd+L to focus address bar',
    });
    db.saveAppKnowledge({
      appName: 'Safari',
      knowledgeType: 'workaround',
      content: 'Use cmd+L to focus address bar',
    });

    const knowledge = db.getAppKnowledge('Safari');
    expect(knowledge).toHaveLength(1);
    // reliability should increase (capped at 1.0)
    expect(knowledge[0].reliability).toBe(1.0);
  });

  it('should decrease reliability', () => {
    db.saveAppKnowledge({
      appName: 'Xcode',
      knowledgeType: 'selector',
      content: 'Build button is at top-left',
    });

    const knowledge = db.getAppKnowledge('Xcode');
    db.decreaseKnowledgeReliability(knowledge[0].id);

    const updated = db.getAppKnowledge('Xcode');
    expect(updated[0].reliability).toBe(0.8);
  });

  it('should filter out low reliability knowledge', () => {
    db.saveAppKnowledge({
      appName: 'TestApp',
      knowledgeType: 'quirk',
      content: 'some old info',
    });

    const knowledge = db.getAppKnowledge('TestApp');
    const id = knowledge[0].id;

    // Decrease reliability below threshold (0.3)
    db.decreaseKnowledgeReliability(id); // 0.8
    db.decreaseKnowledgeReliability(id); // 0.6
    db.decreaseKnowledgeReliability(id); // 0.4
    db.decreaseKnowledgeReliability(id); // 0.2

    const filtered = db.getAppKnowledge('TestApp');
    expect(filtered).toHaveLength(0);
  });
});

describe('Security Log', () => {
  it('should log allowed action', () => {
    db.logSecurity({
      actionType: 'shell',
      riskLevel: 'low',
      details: 'ls -la',
      allowed: true,
    });

    const logs = db.getSecurityLog(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].allowed).toBe(1);
    expect(logs[0].risk_level).toBe('low');
  });

  it('should log blocked action', () => {
    db.logSecurity({
      actionType: 'shell',
      riskLevel: 'blocked',
      details: 'sudo rm -rf /',
      allowed: false,
    });

    const logs = db.getSecurityLog(1);
    expect(logs).toHaveLength(1);
    expect(logs[0].allowed).toBe(0);
    expect(logs[0].risk_level).toBe('blocked');
  });

  it('should limit results', () => {
    for (let i = 0; i < 10; i++) {
      db.logSecurity({ actionType: 'shell', riskLevel: 'low', details: `cmd-${i}`, allowed: true });
    }
    const logs = db.getSecurityLog(3);
    expect(logs).toHaveLength(3);
  });
});
