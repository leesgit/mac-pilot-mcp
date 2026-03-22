import { createHash } from 'crypto';

export function hashScript(script: string): string {
  return createHash('sha256').update(script).digest('hex').slice(0, 16);
}
