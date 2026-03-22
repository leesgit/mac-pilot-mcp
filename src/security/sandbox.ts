import type { ActionType, RiskLevel, SecurityCheckResult } from '../types.js';

// === Blocked Patterns (Hard Block) ===

const BLOCKED_SHELL_PATTERNS: RegExp[] = [
  /rm\s+(-[rRf]+\s+|--recursive\s+)[\/~]/,
  /sudo\s+/,
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
];

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
  // Check blocklist first
  for (const pattern of BLOCKED_SHELL_PATTERNS) {
    if (pattern.test(command)) {
      return 'blocked';
    }
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
