import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRunSchema } from '../schemas.js';
import { runAppleScript, runJxa, escapeForAppleScriptLiteral } from '../engine/applescript.js';
import { runShell } from '../engine/shell.js';
import { checkSecurity } from '../security/sandbox.js';
import type { PilotDatabase } from '../db/database.js';
import { type AuditLogger, maskSensitive } from '../security/audit.js';
import { hashScript } from '../utils/hash.js';
import { classifyError, knowledgeKey, renderHint } from '../learning/error-patterns.js';
import { execSync } from 'child_process';

/**
 * Pull the highest-reliability hints for `appContext` and prepend them as a
 * compact block. Returns "" when there's no app context or no hints — calling
 * code should append to the regular result with no other modifications.
 *
 * Also surfaces one promotion candidate (top success_count) per response so
 * the LLM/user discovers when a pattern is worth saving as a recipe. The
 * dead-end loop fixed: previously `getPromotionCandidates` had no consumer,
 * making the "learn from success" path invisible. Now exactly one suggestion
 * rides on the next tool result for that app.
 */
function prependHints(db: PilotDatabase, appContext: string | undefined): string {
  if (!appContext) return '';
  const hints = db.getReliableHints(appContext, 3);

  // Suggest at most one promotion. We pick the highest-count pattern for THIS
  // app (filter client-side from the global top-N) so the suggestion is
  // contextually relevant; if the top global pattern is from another app we
  // simply skip suggesting on this call.
  const candidates = db.getPromotionCandidates(3, 10).filter(c => c.app_name === appContext);
  const promotion = candidates[0];
  const promotionLine = promotion
    ? `💡 You've completed "${promotion.app_name}/${promotion.pattern_key}" via ${promotion.action_type} ${promotion.success_count} times — consider mac_recipe_save to make it reusable.`
    : '';

  if (hints.length === 0 && !promotionLine) return '';

  const lines: string[] = [];
  for (const h of hints) {
    lines.push(`- [${h.knowledge_type} • ${(h.reliability).toFixed(2)}] ${h.content}`);
  }
  if (promotionLine) lines.push(promotionLine);

  return `<mac-pilot-hints app="${appContext}">\n${lines.join('\n')}\n</mac-pilot-hints>\n\n`;
}

/**
 * Save a structured, deduplicated knowledge entry when a script fails. Returns
 * the classified error so the caller can render the same hint in the result.
 */
function learnFromFailure(
  db: PilotDatabase,
  appContext: string,
  actionType: string,
  rawError: string,
) {
  const cls = classifyError(rawError);
  db.saveAppKnowledge({
    appName: appContext,
    knowledgeType: 'workaround',
    // Stable key (one row per error class + retry strategy) avoids the
    // duplicate-error spam that plagued the previous raw-string storage.
    content: `${knowledgeKey(appContext, actionType, cls)} → ${cls.suggestion}`,
  });
  return cls;
}

/**
 * Record a meaningful success: e.g. `{appContext}.{actionType}.success` so a
 * recipe promotion can fire after N repeats. `pattern_key` is the action
 * shape, not the raw script hash — two different scripts that achieve the
 * same intent count toward the same pattern.
 */
function learnFromSuccess(
  db: PilotDatabase,
  appContext: string,
  actionType: string,
  patternKey: string,
) {
  db.recordSuccessPattern({ appName: appContext, actionType, patternKey });
}

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
    details: JSON.stringify(maskSensitive(args)).slice(0, 500),
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
        params: JSON.stringify(maskSensitive(args)),
        result: result.output || undefined,
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
        scriptHash: hashScript(script!),
      });

      const hintBlock = prependHints(db, appContext);

      if (!result.success) {
        // Structured error learning: classify + dedupe by (app, type, class).
        let suggestion = '';
        if (appContext && result.error) {
          const cls = learnFromFailure(db, appContext, 'applescript', result.error);
          suggestion = `\n\n${renderHint(cls)}`;
        }
        return textResult(`${hintBlock}Error: ${result.error}${suggestion}`, true);
      }

      // Success pattern: key by `tell application "X"` shape, not raw hash.
      if (appContext) {
        const tellMatch = /tell\s+application\s+"([^"]+)"\s+to\s+(\w+)/i.exec(script!);
        const patternKey = tellMatch ? `${tellMatch[1]}/${tellMatch[2]}` : 'misc';
        learnFromSuccess(db, appContext, 'applescript', patternKey);
      }
      return textResult(`${hintBlock}${result.output || '(no output)'}`);
    }

    case 'jxa': {
      const result = runJxa(script!, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(maskSensitive(args)),
        result: result.output || undefined,
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
        scriptHash: hashScript(script!),
      });

      const hintBlock = prependHints(db, appContext);

      if (!result.success) {
        let suggestion = '';
        if (appContext && result.error) {
          const cls = learnFromFailure(db, appContext, 'jxa', result.error);
          suggestion = `\n\n${renderHint(cls)}`;
        }
        return textResult(`${hintBlock}Error: ${result.error}${suggestion}`, true);
      }

      if (appContext) {
        const appMatch = /Application\(["']([^"']+)["']\)/.exec(script!);
        const methodMatch = /Application\([^)]+\)\.(\w+)/.exec(script!);
        const patternKey = appMatch && methodMatch ? `${appMatch[1]}/${methodMatch[1]}` : 'misc';
        learnFromSuccess(db, appContext, 'jxa', patternKey);
      }
      return textResult(`${hintBlock}${result.output || '(no output)'}`);
    }

    case 'shell': {
      const result = runShell(command!, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(maskSensitive(args)),
        result: result.output || undefined,
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
        scriptHash: hashScript(command!),
      });

      const hintBlock = prependHints(db, appContext);

      if (!result.success) {
        let suggestion = '';
        if (appContext && result.error) {
          const cls = learnFromFailure(db, appContext, 'shell', result.error);
          suggestion = `\n\n${renderHint(cls)}`;
        }
        return textResult(`${hintBlock}Error: ${result.error}${suggestion}`, true);
      }
      if (appContext) {
        const cmdHead = command!.trim().split(/\s+/)[0] ?? 'sh';
        learnFromSuccess(db, appContext, 'shell', cmdHead);
      }
      return textResult(`${hintBlock}${result.output || '(no output)'}`);
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
          params: JSON.stringify(maskSensitive(args)),
          success: true,
          durationMs: Date.now() - start,
        });

        return textResult(`Opened: ${target}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        db.logAction({
          actionType,
          appContext: appContext ?? target,
          params: JSON.stringify(maskSensitive(args)),
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
        params: JSON.stringify(maskSensitive(args)),
        success: result.success,
        errorMessage: result.error,
        durationMs: result.durationMs,
      });

      return result.success
        ? textResult(`Clicked at (${x}, ${y})`)
        : textResult(`Click failed: ${result.error}`, true);
    }

    case 'type': {
      let safeText: string;
      try {
        safeText = escapeForAppleScriptLiteral(text!);
      } catch (err) {
        return textResult(`Type failed: ${(err as Error).message}`, true);
      }
      const typeScript = `
        tell application "System Events"
          keystroke "${safeText}"
        end tell
      `;
      const result = runAppleScript(typeScript, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(maskSensitive(args)),
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
      let safeKey: string;
      try {
        safeKey = escapeForAppleScriptLiteral(keyCombo.key);
      } catch (err) {
        return textResult(`Keypress failed: ${(err as Error).message}`, true);
      }
      const keypressScript = keyCombo.modifiers.length > 0
        ? `tell application "System Events" to keystroke "${safeKey}" using {${keyCombo.modifiers.join(', ')}}`
        : `tell application "System Events" to keystroke "${safeKey}"`;

      const result = runAppleScript(keypressScript, timeout);
      db.logAction({
        actionType,
        appContext,
        params: JSON.stringify(maskSensitive(args)),
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
