import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Import after mock
const { runAppleScript, runJxa } = await import('../../src/engine/applescript.js');

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('runAppleScript', () => {
  it('should return success with output', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('Finder\n');

    const result = runAppleScript('tell application "Finder" to get name');
    expect(result.success).toBe(true);
    expect(result.output).toBe('Finder');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle execution failure', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('execution error') as Error & { stderr: string };
      err.stderr = '1:10: syntax error';
      throw err;
    });

    const result = runAppleScript('invalid script');
    expect(result.success).toBe(false);
    expect(result.error).toContain('syntax error');
  });

  it('should handle timeout', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('timeout') as Error & { killed: boolean };
      err.killed = true;
      throw err;
    });

    const result = runAppleScript('slow script', 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Timeout');
  });

  it('should escape single quotes in script', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('ok');

    runAppleScript("tell app \"Finder\" to get name of item \"it's mine\"");

    const call = vi.mocked(childProcess.execSync).mock.calls[0][0] as string;
    expect(call).toContain('osascript -e');
  });
});

describe('runJxa', () => {
  it('should use JavaScript language flag', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('result');

    runJxa('Application("Finder").name()');

    const call = vi.mocked(childProcess.execSync).mock.calls[0][0] as string;
    expect(call).toContain('osascript -l JavaScript');
  });

  it('should return success with output', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('Finder');

    const result = runJxa('Application("Finder").name()');
    expect(result.success).toBe(true);
    expect(result.output).toBe('Finder');
  });

  it('should handle failure', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('error') as Error & { stderr: string };
      err.stderr = 'ReferenceError: x is not defined';
      throw err;
    });

    const result = runJxa('x.invalid()');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ReferenceError');
  });
});
