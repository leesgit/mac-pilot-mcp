import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRunSchema } from '../schemas.js';
import { runAppleScript } from '../engine/applescript.js';
import { runShell } from '../engine/shell.js';
import { checkSecurity } from '../security/sandbox.js';
import type { PilotDatabase } from '../db/database.js';
import type { AuditLogger } from '../security/audit.js';
import { hashScript } from '../utils/hash.js';
import { execSync } from 'child_process';

export function handleMacRun(
  args: Record<string, unknown>,
  db: PilotDatabase,
  audit: AuditLogger,
): CallToolResult {
  const parsed = MacRunSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { actionType, script, command, target, x, y, text, appContext, timeout, dryRun } = parsed.data;

  // Security check
  const secCheck = checkSecurity(actionType, args);
  audit.log({
    actionType,
    riskLevel: secCheck.riskLevel,
    details: JSON.stringify(args).slice(0, 500),
    allowed: secCheck.allowed,
  });

  if (!secCheck.allowed) {
    db.logAction({
      actionType,
      appContext,
      params: JSON.stringify(args),
      success: false,
      errorMessage: secCheck.reason,
    });
    return textResult(`BLOCKED: ${secCheck.reason}`, true);
  }

  // Dry run mode
  if (dryRun) {
    return textResult(JSON.stringify({
      dryRun: true,
      actionType,
      riskLevel: secCheck.riskLevel,
      wouldExecute: true,
      params: args,
    }, null, 2));
  }

  const start = Date.now();

  switch (actionType) {
    case 'applescript': {
      const result = runAppleScript(script!, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(args),
        result: result.output || undefined,
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
        scriptHash: hashScript(script!),
      });

      if (!result.success) {
        // Auto-learn: save error pattern as app knowledge
        if (appContext && result.error) {
          db.saveAppKnowledge({
            appName: appContext,
            knowledgeType: 'workaround',
            content: `AppleScript error: ${result.error.slice(0, 200)}`,
          });
        }

        // Attach app knowledge if available
        const knowledge = appContext ? db.getAppKnowledge(appContext) : [];
        const hints = knowledge.length > 0
          ? `\n\nKnown tips for ${appContext}:\n${knowledge.map(k => `- [${k.knowledge_type}] ${k.content}`).join('\n')}`
          : '';

        return textResult(`Error: ${result.error}${hints}`, true);
      }

      // Auto-learn: reinforce successful patterns
      if (appContext) {
        db.saveAppKnowledge({
          appName: appContext,
          knowledgeType: 'selector',
          content: `Successful script hash: ${hashScript(script!)}`,
        });
      }

      return textResult(result.output || '(no output)');
    }

    case 'shell': {
      const result = runShell(command!, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(args),
        result: result.output || undefined,
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
        scriptHash: hashScript(command!),
      });

      if (!result.success) {
        // Auto-learn: save error pattern
        if (appContext && result.error) {
          db.saveAppKnowledge({
            appName: appContext,
            knowledgeType: 'workaround',
            content: `Shell error: ${result.error.slice(0, 200)}`,
          });
        }
        return textResult(`Error: ${result.error}`, true);
      }
      return textResult(result.output || '(no output)');
    }

    case 'open': {
      try {
        // Determine if target is URL, app name, or file path
        const isUrl = /^https?:\/\//.test(target!);
        const cmd = isUrl ? `open "${target}"` : `open -a "${target}"`;
        execSync(cmd, { timeout: timeout ?? 10000, stdio: 'pipe' });

        db.logAction({
          actionType,
          appContext: appContext ?? target,
          params: JSON.stringify(args),
          success: true,
          durationMs: Date.now() - start,
        });

        return textResult(`Opened: ${target}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        db.logAction({
          actionType,
          appContext: appContext ?? target,
          params: JSON.stringify(args),
          success: false,
          errorMessage: errorMsg,
          durationMs: Date.now() - start,
        });
        return textResult(`Failed to open ${target}: ${errorMsg}`, true);
      }
    }

    case 'click': {
      const clickScript = `
        tell application "System Events"
          click at {${x}, ${y}}
        end tell
      `;
      const result = runAppleScript(clickScript, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(args),
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
      });

      return result.success
        ? textResult(`Clicked at (${x}, ${y})`)
        : textResult(`Click failed: ${result.error}`, true);
    }

    case 'type': {
      const safeText = text!
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const typeScript = `
        tell application "System Events"
          keystroke "${safeText}"
        end tell
      `;
      const result = runAppleScript(typeScript, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(args),
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
      });

      return result.success
        ? textResult(`Typed: "${text}"`)
        : textResult(`Type failed: ${result.error}`, true);
    }

    case 'keypress': {
      const keyCombo = parseKeyCombo(text!);
      const keypressScript = keyCombo.modifiers.length > 0
        ? `tell application "System Events" to keystroke "${keyCombo.key}" using {${keyCombo.modifiers.join(', ')}}`
        : `tell application "System Events" to keystroke "${keyCombo.key}"`;

      const result = runAppleScript(keypressScript, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(args),
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
      });

      return result.success
        ? textResult(`Pressed: ${text}`)
        : textResult(`Keypress failed: ${result.error}`, true);
    }

    default:
      return textResult(`Unknown action type: ${actionType}`, true);
  }
}

function parseKeyCombo(combo: string): { key: string; modifiers: string[] } {
  const parts = combo.toLowerCase().split('+').map(s => s.trim());
  const modifiers: string[] = [];
  let key = '';

  for (const part of parts) {
    switch (part) {
      case 'cmd':
      case 'command':
        modifiers.push('command down');
        break;
      case 'ctrl':
      case 'control':
        modifiers.push('control down');
        break;
      case 'alt':
      case 'option':
        modifiers.push('option down');
        break;
      case 'shift':
        modifiers.push('shift down');
        break;
      default:
        key = part;
    }
  }

  return { key, modifiers };
}
