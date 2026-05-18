import type { ActionType, RiskLevel, SecurityCheckResult } from '../types.js';

// === Blocked Patterns (Hard Block) ===

const BLOCKED_SHELL_PATTERNS: RegExp[] = [
  /rm\s+(-[rRf]+\s+|--recursive\s+)[\/~]/,
  // `$HOME`/`$TMPDIR` and the equivalent `~` (whitespace-prefixed) variants —
  // catches `rm -rf $HOME/Documents` along with `rm -rf "$HOME"`. The shell
  // expands ~ before exec, but the audit/sandbox layer sees the literal.
  /rm\s+(-[rRf]+\s+|--recursive\s+)["']?\$(HOME|TMPDIR|PWD)/i,
  /\bsudo\s+/i,                     // case-insensitive: blocks `Sudo`, `SUDO` too
  /\bsu\s+-c\s/,
  /curl\s.*\|\s*(ba)?sh/,
  /wget\s.*\|\s*(ba)?sh/,
  /chmod\s+777/,
  /mkfs/,
  /dd\s+if=/,
  />\s*\/etc\//,
  />\s*\/System\//,
  />\s*\/Library\//,
  /launchctl\s+(load|submit|bootstrap)/,
  /defaults\s+write.*LoginItems/i,
  /defaults\s+delete\s+/,
  /diskutil\s+(erase|partitionDisk|unmount)/,
  /csrutil\s+disable/,
  /nvram\s+/,
  /spctl\s+--master-disable/,
  /systemsetup\s+/,
  // Subshell / command substitution injection
  /\$\(/,
  /`[^`]+`/,
];

// Pipe sinks that execute the piped-in content as code.
// `cmd | sh` is the canonical remote-code-execution shape.
const PIPE_SINK_BLOCK = /\|\s*(ba|z)?sh\b|\|\s*eval\b|\|\s*python\d?\b|\|\s*node\b|\|\s*ruby\b|\|\s*perl\b|\|\s*tclsh\b/;

// MAC_PILOT_SANDBOX has three modes:
//   - unset / "default": denylist only (current production behavior)
//   - "strict": denylist + chain-token rejection + bare-eval rejection
//   - "allowlist": only commands whose head matches MAC_PILOT_ALLOWLIST pass
type SandboxMode = 'default' | 'strict' | 'allowlist';

function sandboxMode(): SandboxMode {
  const v = process.env.MAC_PILOT_SANDBOX;
  if (v === 'strict' || v === 'allowlist') return v;
  return 'default';
}

function isStrictMode(): boolean {
  const m = sandboxMode();
  return m === 'strict' || m === 'allowlist';
}

// Standalone `eval` invocation. We do NOT block by default (legitimate
// patterns exist: `eval $(ssh-agent)`, shell-init blocks). In strict mode
// we deny it because untrusted LLM-built `eval` is a direct RCE vector.
const BARE_EVAL = /(^|[;&|]\s*)eval\s+/;

/**
 * Parse the allowlist env var. Comma-separated list of command "heads" — the
 * first whitespace-delimited token of a shell command. Example:
 *
 *   MAC_PILOT_ALLOWLIST="ls,date,pwd,echo,which"
 *
 * Any command whose head is not in the list returns `blocked` in
 * allowlist mode. AppleScript/JXA fall back to the regular ruleset
 * (allowlist is a shell-only knob for the moment).
 */
function getAllowlist(): Set<string> | null {
  if (sandboxMode() !== 'allowlist') return null;
  const raw = process.env.MAC_PILOT_ALLOWLIST ?? '';
  return new Set(
    raw.split(',').map(s => s.trim()).filter(Boolean)
  );
}

const BLOCKED_APPLESCRIPT_PATTERNS: RegExp[] = [
  /keystroke.*password/i,
  /keystroke.*secret/i,
  /do\s+shell\s+script.*sudo/i,
  /do\s+shell\s+script.*rm\s+-rf/i,
  /System\s+Preferences.*Security/i,
  /keychain/i,
];

// === Risk Classification ===

function classifyShellRisk(command: string): RiskLevel {
  // Allowlist mode supersedes everything else for shell commands. If a
  // whitelist is configured we *only* run command heads that are in it.
  const allowlist = getAllowlist();
  if (allowlist !== null) {
    const head = command.trim().split(/\s+/)[0] ?? '';
    if (!allowlist.has(head)) return 'blocked';
    // Fall through — even allowlisted commands still must pass the
    // denylist (e.g. `ls` in allowlist + `ls | sh` is still blocked).
  }

  // Check blocklist first
  for (const pattern of BLOCKED_SHELL_PATTERNS) {
    if (pattern.test(command)) {
      return 'blocked';
    }
  }

  // Block any pipe whose sink is a shell/interpreter (cmd | sh, cmd | eval, ...).
  // `hasPipeChain` ignores quoted pipes; combined with PIPE_SINK_BLOCK we catch
  // dynamic forms the literal regex list misses (e.g. variable-built URLs).
  if (hasPipeChain(command) && PIPE_SINK_BLOCK.test(command)) {
    return 'blocked';
  }

  // Strict mode: forbid command chaining outside quotes + bare eval. Useful in
  // shared/multi-tenant environments where the operator wants one tool call =
  // one command. `hasUnsafeChain` excludes quoted/escaped occurrences.
  if (isStrictMode() && (hasUnsafeChain(command) || BARE_EVAL.test(command))) {
    return 'blocked';
  }

  // High risk: file modification, system config
  if (/\b(rm|mv|cp)\b/.test(command) && /\//.test(command)) return 'high';
  if (/\bkill(all)?\b/.test(command)) return 'high';
  if (/\bpkill\b/.test(command)) return 'high';
  if (/\bchmod\b/.test(command)) return 'high';
  if (/\bchown\b/.test(command)) return 'high';

  // Medium risk: writing files, network
  if (/>/.test(command)) return 'medium';
  if (/\bcurl\b/.test(command)) return 'medium';
  if (/\bwget\b/.test(command)) return 'medium';
  if (/\bnpm\s+(install|i|add)\b/.test(command)) return 'medium';
  if (/\bbrew\s+(install|uninstall|remove)\b/.test(command)) return 'medium';

  // Low risk: read-only
  return 'low';
}

function classifyAppleScriptRisk(script: string): RiskLevel {
  for (const pattern of BLOCKED_APPLESCRIPT_PATTERNS) {
    if (pattern.test(script)) {
      return 'blocked';
    }
  }

  // `do shell script` lets AppleScript reach into shell. Re-check the inner
  // command against the shell ruleset so AS doesn't become an injection bypass.
  // We match both double- and single-quoted forms used in AppleScript literals.
  const shellMatchDouble = /do\s+shell\s+script\s+"((?:\\.|[^"\\])*)"/i.exec(script);
  const shellMatchSingle = /do\s+shell\s+script\s+'((?:\\.|[^'\\])*)'/i.exec(script);
  const innerCommand = shellMatchDouble?.[1] ?? shellMatchSingle?.[1];
  if (innerCommand !== undefined) {
    if (classifyShellRisk(innerCommand) === 'blocked') return 'blocked';
  }

  if (/do\s+shell\s+script/.test(script)) return 'high';
  if (/delete|remove|trash/i.test(script)) return 'high';
  if (/System\s+Events/i.test(script) && /keystroke|click|key\s+code/i.test(script)) return 'medium';

  return 'low';
}

function classifyActionRisk(actionType: ActionType, params: Record<string, unknown>): RiskLevel {
  switch (actionType) {
    case 'shell':
      return classifyShellRisk(String(params.command ?? ''));

    case 'applescript':
      return classifyAppleScriptRisk(String(params.script ?? ''));

    case 'jxa':
      return classifyAppleScriptRisk(String(params.script ?? ''));

    case 'open':
      return 'low';

    case 'click':
    case 'type':
    case 'keypress':
      return 'medium';

    default:
      return 'medium';
  }
}

// === Main Check Function ===

export function checkSecurity(actionType: ActionType, params: Record<string, unknown>): SecurityCheckResult {
  const riskLevel = classifyActionRisk(actionType, params);

  if (riskLevel === 'blocked') {
    const detail = actionType === 'shell'
      ? `Blocked dangerous shell command: ${String(params.command ?? '').slice(0, 100)}`
      : `Blocked dangerous script: ${String(params.script ?? '').slice(0, 100)}`;

    return {
      allowed: false,
      riskLevel: 'blocked',
      reason: detail,
    };
  }

  return {
    allowed: true,
    riskLevel,
  };
}

// === Pipe Chain Detection ===

// Detect command chain tokens (`;`, `&&`, `||`) that aren't inside quotes
// or escaped. Used only in strict mode — they're valid shell in casual use.
export function hasUnsafeChain(command: string): boolean {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    const prev = i > 0 ? command[i - 1] : '';

    if (char === "'" && prev !== '\\' && !inDouble) inSingle = !inSingle;
    if (char === '"' && prev !== '\\' && !inSingle) inDouble = !inDouble;
    if (inSingle || inDouble || prev === '\\') continue;

    if (char === ';') return true;
    if (char === '&' && command[i + 1] === '&') return true;
    if (char === '|' && command[i + 1] === '|') return true;
  }

  return false;
}

export function hasPipeChain(command: string): boolean {
  // Simple pipe detection: cmd1 | cmd2
  // Excludes pipes inside quotes
  let inSingle = false;
  let inDouble = false;
  let pipeCount = 0;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    const prev = i > 0 ? command[i - 1] : '';

    if (char === "'" && prev !== '\\' && !inDouble) inSingle = !inSingle;
    if (char === '"' && prev !== '\\' && !inSingle) inDouble = !inDouble;
    if (char === '|' && !inSingle && !inDouble) {
      // Skip || (logical OR)
      if (command[i + 1] === '|') {
        i++; // skip next |
        continue;
      }
      // Skip if preceded by | (second char of ||, already handled)
      if (i > 0 && command[i - 1] === '|') continue;
      pipeCount++;
    }
  }

  return pipeCount > 0;
}
