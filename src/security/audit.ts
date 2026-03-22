import type { PilotDatabase } from '../db/database.js';
import type { RiskLevel } from '../types.js';

export class AuditLogger {
  constructor(private db: PilotDatabase) {}

  log(entry: {
    actionType: string;
    riskLevel: RiskLevel;
    details: string;
    allowed: boolean;
  }): void {
    this.db.logSecurity(entry);
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
