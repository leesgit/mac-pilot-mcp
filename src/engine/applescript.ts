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

/**
 * Escape user-supplied text for safe interpolation inside an AppleScript
 * string literal (the part between the double quotes). Rejects control
 * characters that could break AppleScript parsing or smuggle hidden behavior;
 * the caller should fall back to a friendly error if this throws.
 */
export function escapeForAppleScriptLiteral(str: string): string {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Allow tab + line breaks; reject the rest of the C0 control range and DEL.
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      throw new Error(`Control character U+${code.toString(16).padStart(4, '0')} not allowed in AppleScript text`);
    }
    if (code === 0x7f) {
      throw new Error('DEL character not allowed in AppleScript text');
    }
  }
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
