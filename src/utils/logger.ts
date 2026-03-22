export function log(message: string): void {
  console.error(`[mac-pilot] ${message}`);
}

export function logError(message: string, error?: unknown): void {
  const errorMsg = error instanceof Error ? error.message : String(error ?? '');
  console.error(`[mac-pilot] ERROR: ${message}${errorMsg ? ` - ${errorMsg}` : ''}`);
}
