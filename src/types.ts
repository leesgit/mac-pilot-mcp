import type { CallToolResult as SDKCallToolResult } from '@modelcontextprotocol/sdk/types.js';

// === MCP Tool 정의 ===

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type CallToolResult = SDKCallToolResult;

export function textResult(text: string, isError?: boolean): CallToolResult {
  return {
    content: [{ type: 'text' as const, text }],
    isError
  };
}

// === Action Types ===

export type ActionType = 'applescript' | 'jxa' | 'shell' | 'open' | 'click' | 'type' | 'keypress';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export interface ActionParams {
  actionType: ActionType;
  script?: string;
  command?: string;
  target?: string;
  x?: number;
  y?: number;
  text?: string;
  appContext?: string;
  timeout?: number;
  dryRun?: boolean;
}

export interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  riskLevel: RiskLevel;
}

// === Recipe Types ===

export interface RecipeStep {
  actionType: ActionType;
  params: Record<string, unknown>;
  description: string;
}

export interface RecipeParameter {
  name: string;
  description: string;
  defaultValue?: string;
}

export interface Recipe {
  id: number;
  name: string;
  description: string;
  app?: string;
  steps: RecipeStep[];
  parameters?: RecipeParameter[];
  tags?: string[];
  runCount: number;
  successCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

// === Action Log Types ===

export interface ActionLogEntry {
  id: number;
  actionType: ActionType;
  appContext?: string;
  params: string;
  result?: string;
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
  scriptHash?: string;
  createdAt: string;
}

// === App Knowledge Types ===

export type KnowledgeType = 'quirk' | 'selector' | 'workaround' | 'version_note';

export interface AppKnowledge {
  id: number;
  appName: string;
  knowledgeType: KnowledgeType;
  content: string;
  reliability: number;
  createdAt: string;
  updatedAt: string;
}

// === Security Types ===

export interface SecurityCheckResult {
  allowed: boolean;
  riskLevel: RiskLevel;
  reason?: string;
}

export interface SecurityLogEntry {
  actionType: string;
  riskLevel: RiskLevel;
  details: string;
  allowed: boolean;
}
