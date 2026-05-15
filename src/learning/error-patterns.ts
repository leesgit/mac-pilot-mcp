/**
 * Error pattern normalization.
 *
 * Raw AppleScript/JXA/shell errors are noisy, timestamp-flecked, and useless
 * as `app_knowledge.content` (every invocation creates a new dedupe-resistant
 * row). This module classifies an error into a small, stable taxonomy with
 * an actionable suggestion, so future calls can short-circuit or self-correct.
 *
 * Used in `tools/run.ts` to replace `"AppleScript error: <raw>"` storage with
 * a structured hint the model can act on.
 */

export type ErrorClass =
  | 'permission'        // TCC/Accessibility/Automation denied
  | 'app_not_running'   // tell application but app isn't open / not installed
  | 'object_missing'    // UI element / window / document doesn't exist
  | 'invalid_syntax'    // AS/JXA parse error
  | 'timeout'           // execSync killed
  | 'rate_limit'        // app refused due to throttling (rare on macOS)
  | 'unknown';

export interface ClassifiedError {
  errorClass: ErrorClass;
  /** One-line suggestion the model can read. Stable across raw error text. */
  suggestion: string;
  /** If non-null, the suggested alternative method to retry with. */
  retryStrategy?: 'request_permission' | 'launch_app_first' | 'use_jxa' | 'use_applescript' | 'use_ax_query' | 'check_param';
  /** Original error retained for reference, truncated. */
  rawExcerpt: string;
}

// Order matters: more specific rules first.
const RULES: Array<{ pattern: RegExp; cls: ErrorClass; suggestion: string; retry?: ClassifiedError['retryStrategy'] }> = [
  // Permission / Accessibility / Automation
  { pattern: /not\s+allowed\s+(to\s+)?(send\s+)?Apple\s*events?|not authorized to send/i,
    cls: 'permission',
    suggestion: 'Grant Automation permission: System Settings → Privacy & Security → Automation → [your client app] → enable the target app.',
    retry: 'request_permission' },
  { pattern: /assistive\s+access|accessibility/i,
    cls: 'permission',
    suggestion: 'Grant Accessibility permission: System Settings → Privacy & Security → Accessibility → enable [your client app].',
    retry: 'request_permission' },
  { pattern: /access\s+not\s+allowed/i,
    cls: 'permission',
    suggestion: 'macOS denied the operation. Check Privacy & Security settings for Automation or Accessibility.',
    retry: 'request_permission' },

  // App not running / not installed
  { pattern: /application\s+isn['’]?t\s+running/i,
    cls: 'app_not_running',
    suggestion: 'Open the application first (use the `open` action), then retry.',
    retry: 'launch_app_first' },
  { pattern: /can[''’]?t\s+get\s+application\s+"[^"]+"|file\s+.*\s+wasn['’]?t\s+found/i,
    cls: 'app_not_running',
    suggestion: 'Application not installed or name mismatch. Verify exact app name (e.g. "Visual Studio Code" not "VSCode").',
    retry: 'check_param' },

  // Object/element missing
  { pattern: /object\s+is\s+not\s+accessible/i,
    cls: 'object_missing',
    suggestion: 'The target UI element isn\'t reachable. Try `mac_find_ui` to discover available elements, or fall back to JXA.',
    retry: 'use_ax_query' },
  { pattern: /can[''’]?t\s+get\s+(window|menu\s+item|button|text\s+field)/i,
    cls: 'object_missing',
    suggestion: 'Referenced UI element doesn\'t exist right now. Use `mac_find_ui` first to confirm the element is present.',
    retry: 'use_ax_query' },

  // Syntax
  { pattern: /syntax\s+error|expected.+but\s+found|end\s+of\s+script\b/i,
    cls: 'invalid_syntax',
    suggestion: 'Script has a syntax error. If using AppleScript and the API feels JS-shaped, try `actionType: "jxa"` instead.',
    retry: 'use_jxa' },

  // Timeout
  { pattern: /timeout\s+after\s+\d+ms/i,
    cls: 'timeout',
    suggestion: 'The script ran longer than the timeout. Increase `timeout` (max 60000ms), or split into smaller steps.',
    retry: 'check_param' },

  // Rate limit (rare)
  { pattern: /rate\s+limit|too\s+many\s+requests/i,
    cls: 'rate_limit',
    suggestion: 'Wait a few seconds and retry.',
    retry: undefined },
];

export function classifyError(rawError: string): ClassifiedError {
  const excerpt = rawError.length > 200 ? rawError.slice(0, 200) + '…' : rawError;
  for (const rule of RULES) {
    if (rule.pattern.test(rawError)) {
      return {
        errorClass: rule.cls,
        suggestion: rule.suggestion,
        retryStrategy: rule.retry,
        rawExcerpt: excerpt,
      };
    }
  }
  return {
    errorClass: 'unknown',
    suggestion: 'Unclassified error. Inspect the raw message and consider trying an alternative actionType.',
    rawExcerpt: excerpt,
  };
}

/**
 * Stable content key for `app_knowledge` dedup. Two raw errors that classify
 * the same and target the same app/action collapse to one row.
 */
export function knowledgeKey(appName: string, actionType: string, cls: ClassifiedError): string {
  return `${appName}::${actionType}::${cls.errorClass}::${cls.retryStrategy ?? 'none'}`;
}

/** Render a hint that's compact enough to attach to every tool result. */
export function renderHint(cls: ClassifiedError): string {
  const retry = cls.retryStrategy ? ` [retry: ${cls.retryStrategy}]` : '';
  return `[${cls.errorClass}]${retry} ${cls.suggestion}`;
}
