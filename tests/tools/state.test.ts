import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const { handleMacState } = await import('../../src/tools/state.js');

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('handleMacState', () => {
  it('should query frontmost app', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('Safari\n');

    const result = handleMacState({ include: ['frontmost_app'] });

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.frontmostApp).toBe('Safari');
  });

  it('should query clipboard', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('copied text\n');

    const result = handleMacState({ include: ['clipboard'] });

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.clipboard).toBe('copied text');
  });

  it('should query running apps', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('Finder, Safari, Terminal\n');

    const result = handleMacState({ include: ['running_apps'] });

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.runningApps).toContain('Finder');
    expect(parsed.runningApps).toContain('Safari');
  });

  it('should handle empty params (query all)', () => {
    vi.mocked(childProcess.execSync).mockReturnValue('Finder\n');

    const result = handleMacState({});

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    // Should have all fields
    expect(parsed).toHaveProperty('frontmostApp');
    expect(parsed).toHaveProperty('clipboard');
    expect(parsed).toHaveProperty('runningApps');
  });

  it('should handle AppleScript errors gracefully', () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      const err = new Error('error') as Error & { stderr: string };
      err.stderr = 'access not allowed';
      throw err;
    });

    const result = handleMacState({ include: ['frontmost_app'] });

    const text = (result.content[0] as { text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.frontmostApp).toContain('Error');
  });
});
