import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacFindUiSchema } from '../schemas.js';
import { findUIElements } from '../engine/accessibility.js';

export function handleMacFindUi(args: Record<string, unknown>): CallToolResult {
  const parsed = MacFindUiSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { app, role, title, searchText, maxResults } = parsed.data;

  const result = findUIElements(app, { role, title, searchText, maxResults });

  if (!result.success) {
    return textResult(`Failed to find UI elements: ${result.error}`, true);
  }

  if (result.elements.length === 0) {
    return textResult(`No UI elements found in ${app} matching the criteria.`);
  }

  return textResult(JSON.stringify({
    app,
    count: result.elements.length,
    elements: result.elements,
  }, null, 2));
}
