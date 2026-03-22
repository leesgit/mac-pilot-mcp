import { execSync } from 'child_process';
import { logError } from '../utils/logger.js';

export interface AppleScriptResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export function runAppleScript(script: string, timeout: number = 10000): AppleScriptResult {
  const start = Date.now();

  try {
    const output = execSync(`osascript -e ${escapeForShell(script)}`, {
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      success: true,
      output: output.trim(),
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string; killed?: boolean };
    const errorMsg = error.killed
      ? `Timeout after ${timeout}ms`
      : (error.stderr ?? error.message ?? 'Unknown error');

    logError('AppleScript execution failed', errorMsg);

    return {
      success: false,
      output: '',
      error: String(errorMsg).trim(),
      durationMs: Date.now() - start,
    };
  }
}

export function runJxa(script: string, timeout: number = 10000): AppleScriptResult {
  const start = Date.now();

  try {
    const output = execSync(`osascript -l JavaScript -e ${escapeForShell(script)}`, {
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      success: true,
      output: output.trim(),
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string; killed?: boolean };
    const errorMsg = error.killed
      ? `Timeout after ${timeout}ms`
      : (error.stderr ?? error.message ?? 'Unknown error');

    logError('JXA execution failed', errorMsg);

    return {
      success: false,
      output: '',
      error: String(errorMsg).trim(),
      durationMs: Date.now() - start,
    };
  }
}

function escapeForShell(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}
