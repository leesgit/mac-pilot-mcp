import { z } from 'zod';

// === mac_run ===

export const ActionTypeEnum = z.enum([
  'applescript', 'jxa', 'shell', 'open', 'click', 'type', 'keypress'
]);

export const MacRunSchema = z.object({
  actionType: ActionTypeEnum,
  script: z.string().optional(),
  command: z.string().optional(),
  target: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  appContext: z.string().optional(),
  timeout: z.number().min(100).max(30000).default(10000).optional(),
  dryRun: z.boolean().default(false).optional(),
}).refine(data => {
  if (data.actionType === 'applescript' && !data.script) return false;
  if (data.actionType === 'jxa' && !data.script) return false;
  if (data.actionType === 'shell' && !data.command) return false;
  if (data.actionType === 'open' && !data.target) return false;
  if (data.actionType === 'click' && (data.x === undefined || data.y === undefined)) return false;
  if (data.actionType === 'type' && !data.text) return false;
  if (data.actionType === 'keypress' && !data.text) return false;
  return true;
}, {
  message: 'Missing required parameters for the specified actionType'
});

// === mac_find_ui ===

export const MacFindUiSchema = z.object({
  app: z.string(),
  role: z.string().optional(),
  title: z.string().optional(),
  searchText: z.string().optional(),
  maxResults: z.number().min(1).max(50).default(10).optional(),
});

// === mac_screenshot ===

export const ScreenshotTargetEnum = z.enum(['screen', 'window', 'region']);

export const MacScreenshotSchema = z.object({
  target: ScreenshotTargetEnum,
  windowName: z.string().optional(),
  region: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  scale: z.number().min(0.1).max(1.0).default(0.5).optional(),
}).refine(data => {
  if (data.target === 'window' && !data.windowName) return false;
  if (data.target === 'region' && !data.region) return false;
  return true;
}, {
  message: 'Missing required parameters for the specified target type'
});

// === mac_state ===

export const StateFieldEnum = z.enum([
  'frontmost_app', 'windows', 'clipboard', 'selected_files', 'running_apps'
]);

export const MacStateSchema = z.object({
  include: z.array(StateFieldEnum).optional(),
});

// === mac_recipe_save ===

export const RecipeStepSchema = z.object({
  actionType: ActionTypeEnum,
  params: z.record(z.unknown()),
  description: z.string(),
});

export const RecipeParameterSchema = z.object({
  name: z.string(),
  description: z.string(),
  defaultValue: z.string().optional(),
});

export const MacRecipeSaveSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  app: z.string().optional(),
  steps: z.array(RecipeStepSchema).min(1),
  parameters: z.array(RecipeParameterSchema).optional(),
  tags: z.array(z.string()).optional(),
});

// === mac_recipe_run ===

export const MacRecipeRunSchema = z.object({
  name: z.string(),
  params: z.record(z.string()).optional(),
  dryRun: z.boolean().default(false).optional(),
});

// === mac_recipe_search ===

export const MacRecipeSearchSchema = z.object({
  query: z.string().min(1),
  app: z.string().optional(),
  includeHistory: z.boolean().default(false).optional(),
});
