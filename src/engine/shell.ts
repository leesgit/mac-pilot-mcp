import { execSync } from 'child_process';
import { logError } from '../utils/logger.js';
import { hasPipeChain } from '../security/sandbox.js';

export interface ShellResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export function runShell(command: string, timeout: number = 10000): ShellResult {
  const start = Date.now();

  // Security check is already done in run.ts handleMacRun — no duplicate check here

  // Reject pipe chains
  if (hasPipeChain(command)) {
    return {
      success: false,
      output: '',
      error: 'Pipe chains are not allowed. Execute each command separately.',
      durationMs: Date.now() - start,
    };
  }

  try {
    const output = execSync(command, {
      timeout,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/zsh',
    });

    return {
      success: true,
      output: output.trim(),
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string; killed?: boolean };
    const errorMsg = error.killed
      ? `Timeout after ${timeout}ms`
      : (error.stderr ?? error.message ?? 'Unknown error');

    logError('Shell execution failed', errorMsg);

    return {
      success: false,
      output: error.stdout?.trim() ?? '',
      error: String(errorMsg).trim(),
      durationMs: Date.now() - start,
    };
  }
}
