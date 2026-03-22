import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRecipeSaveSchema } from '../schemas.js';
import type { PilotDatabase } from '../db/database.js';

export function handleRecipeSave(
  args: Record<string, unknown>,
  db: PilotDatabase,
): CallToolResult {
  const parsed = MacRecipeSaveSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { name, description, app, steps, parameters, tags } = parsed.data;

  // Check if recipe already exists
  const existing = db.getRecipe(name);
  if (existing) {
    return textResult(`Recipe "${name}" already exists. Use a different name or delete the existing one.`, true);
  }

  try {
    const id = db.saveRecipe({
      name,
      description,
      app,
      steps: JSON.stringify(steps),
      parameters: parameters ? JSON.stringify(parameters) : undefined,
      tags: tags ? JSON.stringify(tags) : undefined,
    });

    return textResult(JSON.stringify({
      saved: true,
      id,
      name,
      description,
      stepsCount: steps.length,
      parametersCount: parameters?.length ?? 0,
    }, null, 2));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return textResult(`Failed to save recipe: ${errorMsg}`, true);
  }
}
