import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, PilotDatabase } from '../../src/db/database.js';
import { AuditLogger } from '../../src/security/audit.js';
import * as childProcess from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const { handleMacRun } = await import('../../src/tools/run.js');

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

describe('handleMacRun', () => {
  it('should reject invalid params', () => {
    const result = handleMacRun({}, db, audit);
    expect(result.isError).toBe(true);
  });

  it('should block dangerous shell commands', () => {
    const result = handleMacRun(
      { actionType: 'shell', command: 'sudo rm -rf /' },
      db,
      audit,
    );
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('BLOCKED');

    // Should log to security
    const secLogs = db.getSecurityLog(1);
    expect(secLogs).toHaveLength(1);
    expect(secLogs[0].allowed).toBe(0);
  });

  it('should execute shell command and log', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('/Users/test\n');

    const result = handleMacRun(
      { actionType: 'shell', command: 'pwd' },
      db,
      audit,
    );

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('/Users/test');

    // Should log action
    const actionLogs = db.getActionLog({ limit: 1 });
    expect(actionLogs).toHaveLength(1);
    expect(actionLogs[0].success).toBe(1);
  });

  it('should handle dryRun mode', () => {
    const result = handleMacRun(
      { actionType: 'open', target: 'Safari', dryRun: true },
      db,
      audit,
    );

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.actionType).toBe('open');
    expect(parsed.wouldExecute).toBe(true);

    // execSync should NOT be called
    expect(childProcess.execSync).not.toHaveBeenCalled();
  });

  it('should execute applescript', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('Finder\n');

    const result = handleMacRun(
      { actionType: 'applescript', script: 'tell application "Finder" to get name' },
      db,
      audit,
    );

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toBe('Finder');
  });

  it('should log failed applescript with app knowledge hint', () => {
    // First, save some app knowledge
    db.saveAppKnowledge({
      appName: 'Figma',
      knowledgeType: 'quirk',
      content: 'Use File > Export As instead of File > Export',
    });

    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('error') as Error & { stderr: string };
      err.stderr = 'menu item not found';
      throw err;
    });

    const result = handleMacRun(
      { actionType: 'applescript', script: 'tell app "Figma" to click menu "Export"', appContext: 'Figma' },
      db,
      audit,
    );

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('<mac-pilot-hints app="Figma">');
    expect(text).toContain('File > Export As');
  });

  it('should surface a promotion suggestion after N successes (P3 dead-end fix)', () => {
    // 3 prior successes for the same Calendar/add pattern primes promotion.
    db.recordSuccessPattern({ appName: 'Calendar', actionType: 'applescript', patternKey: 'Calendar/make' });
    db.recordSuccessPattern({ appName: 'Calendar', actionType: 'applescript', patternKey: 'Calendar/make' });
    db.recordSuccessPattern({ appName: 'Calendar', actionType: 'applescript', patternKey: 'Calendar/make' });

    vi.mocked(childProcess.execSync).mockReturnValue('OK\n');

    const result = handleMacRun(
      { actionType: 'applescript', script: 'tell application "Calendar" to make event', appContext: 'Calendar' },
      db,
      audit,
    );

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    // The hint block must appear and include the promotion suggestion line.
    expect(text).toContain('<mac-pilot-hints app="Calendar">');
    expect(text).toContain('mac_recipe_save');
    expect(text).toMatch(/Calendar\/Calendar\/make/);
  });

  it('should NOT promote patterns below threshold', () => {
    // Only one success — below the threshold of 3.
    db.recordSuccessPattern({ appName: 'Mail', actionType: 'applescript', patternKey: 'Mail/send' });

    vi.mocked(childProcess.execSync).mockReturnValue('OK\n');

    const result = handleMacRun(
      { actionType: 'applescript', script: 'tell application "Mail" to send', appContext: 'Mail' },
      db,
      audit,
    );

    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toContain('mac_recipe_save');
  });

  it('should execute open action', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('');

    const result = handleMacRun(
      { actionType: 'open', target: 'Safari' },
      db,
      audit,
    );

    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Opened: Safari');
  });

  it('should execute open URL', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('');

    const result = handleMacRun(
      { actionType: 'open', target: 'https://google.com' },
      db,
      audit,
    );

    expect(result.isError).toBeUndefined();
    const call = vi.mocked(childProcess.execSync).mock.calls[0][0] as string;
    expect(call).toContain('open "https://google.com"');
  });
});
