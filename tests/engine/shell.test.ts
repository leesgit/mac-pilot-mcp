import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const { runShell } = await import('../../src/engine/shell.js');

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('runShell', () => {
  it('should return success with output', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('/Users/test\n');

    const result = runShell('pwd');
    expect(result.success).toBe(true);
    expect(result.output).toBe('/Users/test');
  });

  it('should block dangerous commands', () => {
    const result = runShell('sudo rm -rf /');
    expect(result.success).toBe(false);
    expect(result.error).toContain('BLOCKED');
    // execSync should NOT be called
    expect(childProcess.execSync).not.toHaveBeenCalled();
  });

  it('should block pipe chains', () => {
    const result = runShell('cat file | grep test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Pipe chains');
    expect(childProcess.execSync).not.toHaveBeenCalled();
  });

  it('should handle command failure', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('error') as Error & { stderr: string; stdout: string };
      err.stderr = 'command not found: foobar';
      err.stdout = '';
      throw err;
    });

    const result = runShell('foobar');
    expect(result.success).toBe(false);
    expect(result.error).toContain('command not found');
  });

  it('should handle timeout', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('timeout') as Error & { killed: boolean };
      err.killed = true;
      throw err;
    });

    const result = runShell('sleep 100', 1000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Timeout');
  });

  it('should allow safe commands', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('file.txt\n');

    const result = runShell('ls -la');
    expect(result.success).toBe(true);
    expect(childProcess.execSync).toHaveBeenCalled();
  });
});
