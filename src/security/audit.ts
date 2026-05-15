import type { PilotDatabase } from '../db/database.js';
import type { RiskLevel } from '../types.js';

// Keys whose values must never land in the audit log in clear text.
// Matches common credential-bearing field names case-insensitively.
const SENSITIVE_KEY_RE = /^(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|authorization|auth|bearer|cookie|session|private[_-]?key)$/i;

// Heuristic: long values that look like bearer/JWT/API tokens, masked even
// when the surrounding key name is innocuous (e.g. `details: "Bearer eyJ..."`).
const TOKEN_VALUE_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._\-+/=]{16,}\b|\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g;

const MASK = '***MASKED***';

function maskString(value: string): string {
  return value.replace(TOKEN_VALUE_RE, MASK);
}

export function maskSensitive(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return maskString(input);
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(maskSensitive);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = MASK;
    } else {
      out[key] = maskSensitive(value);
    }
  }
  return out;
}

export class AuditLogger {
  constructor(private db: PilotDatabase) {}

  log(entry: {
    actionType: string;
    riskLevel: RiskLevel;
    details: string;
    allowed: boolean;
  }): void {
    this.db.logSecurity({
      ...entry,
      details: maskString(entry.details),
    });
  }

  getRecentBlocked(limit: number = 10): Array<{
    action_type: string;
    risk_level: string;
    details: string;
    created_at: string;
  }> {
    const logs = this.db.getSecurityLog(limit * 2);
    return logs
      .filter(l => l.allowed === 0)
      .slice(0, limit)
      .map(l => ({
        action_type: l.action_type,
        risk_level: l.risk_level,
        details: l.details,
        created_at: l.created_at,
      }));
  }
}
