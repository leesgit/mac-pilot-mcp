import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacRecipeRunSchema } from '../schemas.js';
import type { PilotDatabase } from '../db/database.js';
import type { AuditLogger } from '../security/audit.js';
import { handleMacRun } from './run.js';
import type { RecipeStep } from '../types.js';

export function handleRecipeRun(
  args: Record<string, unknown>,
  db: PilotDatabase,
  audit: AuditLogger,
): CallToolResult {
  const parsed = MacRecipeRunSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { name, params, dryRun } = parsed.data;

  const recipe = db.getRecipe(name);
  if (!recipe) {
    return textResult(`Recipe "${name}" not found. Use mac_recipe_search to find available recipes.`, true);
  }

  let steps: RecipeStep[];
  try {
    steps = JSON.parse(recipe.steps) as RecipeStep[];
  } catch {
    return textResult(`Recipe "${name}" has invalid steps format.`, true);
  }

  // Substitute parameters in steps
  const substitutedSteps = steps.map(step => substituteParams(step, params ?? {}));

  if (dryRun) {
    return textResult(JSON.stringify({
      dryRun: true,
      recipe: name,
      description: recipe.description,
      stepsCount: substitutedSteps.length,
      steps: substitutedSteps.map((s, i) => ({
        step: i + 1,
        actionType: s.actionType,
        description: s.description,
        params: s.params,
      })),
    }, null, 2));
  }

  // Execute steps sequentially
  const results: Array<{ step: number; success: boolean; output?: string; error?: string }> = [];
  let allSuccess = true;

  for (let i = 0; i < substitutedSteps.length; i++) {
    const step = substitutedSteps[i];
    const stepArgs = {
      actionType: step.actionType,
      ...step.params,
      appContext: recipe.app ?? undefined,
    };

    const result = handleMacRun(stepArgs, db, audit);
    const isError = result.isError ?? false;
    const outputText = result.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    results.push({
      step: i + 1,
      success: !isError,
      output: !isError ? outputText : undefined,
      error: isError ? outputText : undefined,
    });

    if (isError) {
      allSuccess = false;
      break; // Stop on first failure
    }
  }

  // Update recipe stats
  db.updateRecipeStats(name, allSuccess);

  return textResult(JSON.stringify({
    recipe: name,
    success: allSuccess,
    stepsExecuted: results.length,
    totalSteps: substitutedSteps.length,
    results,
  }, null, 2), !allSuccess);
}

function substituteParams(step: RecipeStep, params: Record<string, string>): RecipeStep {
  let paramsStr = JSON.stringify(step.params);
  let descStr = step.description;

  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{{${key}}}`;
    paramsStr = paramsStr.replaceAll(placeholder, value);
    descStr = descStr.replaceAll(placeholder, value);
  }

  return {
    actionType: step.actionType,
    params: JSON.parse(paramsStr) as Record<string, unknown>,
    description: descStr,
  };
}
