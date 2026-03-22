import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRecipeSearchSchema } from '../schemas.js';
import type { PilotDatabase } from '../db/database.js';

export function handleRecipeSearch(
  args: Record<string, unknown>,
  db: PilotDatabase,
): CallToolResult {
  const parsed = MacRecipeSearchSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { query, app, includeHistory } = parsed.data;

  // Search recipes
  const recipes = db.searchRecipes(query, app);

  // Optionally search action history
  let historyResults: Array<{
    id: number;
    action_type: string;
    app_context: string | null;
    params: string;
    error_message: string | null;
    success: number;
  }> = [];

  if (includeHistory) {
    historyResults = db.searchActionLog(query);
  }

  if (recipes.length === 0 && historyResults.length === 0) {
    return textResult(`No recipes or history found for: "${query}"`);
  }

  const response: Record<string, unknown> = {
    query,
    recipesFound: recipes.length,
  };

  if (recipes.length > 0) {
    response.recipes = recipes.map(r => ({
      name: r.name,
      description: r.description,
      app: r.app,
      runCount: r.run_count,
      successCount: r.success_count,
      successRate: r.run_count > 0
        ? `${Math.round((r.success_count / r.run_count) * 100)}%`
        : 'N/A',
    }));
  }

  if (historyResults.length > 0) {
    response.historyFound = historyResults.length;
    response.history = historyResults.map(h => ({
      id: h.id,
      actionType: h.action_type,
      app: h.app_context,
      success: h.success === 1,
      error: h.error_message,
    }));
  }

  return textResult(JSON.stringify(response, null, 2));
}
