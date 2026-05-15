import { execSync } from 'child_process';
import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { z } from 'zod';

/**
 * Standalone clipboard tool. Previously the clipboard could only be read
 * through `mac_state`, which pulled the whole system state along with it —
 * unnecessary cost for a one-shot copy/paste flow.
 *
 * Uses `pbpaste` / `pbcopy` directly because they're faster and quieter
 * than AppleScript's `the clipboard`, and they handle binary-safe text
 * correctly (AppleScript collapses some control chars).
 */

const SCHEMA = z.object({
  action: z.enum(['read', 'write', 'clear']),
  text: z.string().optional(),
}).refine(d => d.action !== 'write' || typeof d.text === 'string', {
  message: '`text` is required when action is "write"',
});

export function handleMacClipboard(args: Record<string, unknown>): CallToolResult {
  const parsed = SCHEMA.safeParse(args);
  if (!parsed.success) return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  const { action, text } = parsed.data;

  try {
    if (action === 'read') {
      const out = execSync('pbpaste', { encoding: 'utf-8', timeout: 2000 });
      return textResult(out);
    }
    if (action === 'clear') {
      execSync('pbcopy', { input: '', timeout: 2000 });
      return textResult('Clipboard cleared');
    }
    // write
    execSync('pbcopy', { input: text ?? '', timeout: 2000, encoding: undefined });
    return textResult(`Wrote ${text!.length} characters to clipboard`);
  } catch (err) {
    return textResult(`Clipboard ${action} failed: ${(err as Error).message}`, true);
  }
}
