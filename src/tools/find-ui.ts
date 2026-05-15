import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacFindUiSchema } from '../schemas.js';
import { findUIElements } from '../engine/accessibility.js';
import { tryElectronAX, KNOWN_ELECTRON_BUNDLE_IDS } from '../engine/electron-fallback.js';

export async function handleMacFindUi(args: Record<string, unknown>): Promise<CallToolResult> {
  const parsed = MacFindUiSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { app, role, title, searchText, maxResults, useElectronFallback, electronCdpPort } = parsed.data;

  const result = findUIElements(app, { role, title, searchText, maxResults });

  // Decide whether to attempt the Electron CDP fallback. The fallback is
  // intentionally a *complement* to AX, not a replacement — we only try it
  // when AX is unhelpful (empty results) and either the caller asked for it
  // explicitly or the app is a known Electron container.
  const axEmpty = !result.success || result.elements.length === 0;
  const isKnownElectron = Object.prototype.hasOwnProperty.call(KNOWN_ELECTRON_BUNDLE_IDS, app);
  const fallbackRequested =
    useElectronFallback === true ||
    (useElectronFallback === 'auto' && isKnownElectron);
  const shouldTryFallback = fallbackRequested && (axEmpty || useElectronFallback === true);

  if (shouldTryFallback) {
    const electron = await tryElectronAX(app, { port: electronCdpPort });
    if (electron.success && electron.tree) {
      const filtered = filterElectronAxTree(electron.tree, { role, title, searchText, maxResults: maxResults ?? 10 });
      return textResult(JSON.stringify({
        app,
        source: 'electron-cdp',
        bundleId: electron.bundleId,
        cdpPort: electron.cdpPort,
        count: filtered.length,
        elements: filtered,
      }, null, 2));
    }

    // Fallback failed — surface a useful error alongside the AX result.
    if (result.success && result.elements.length === 0) {
      return textResult(JSON.stringify({
        app,
        source: 'accessibility',
        count: 0,
        elements: [],
        electronFallback: {
          attempted: true,
          error: electron.error,
          activationHint: electron.activationHint,
        },
      }, null, 2));
    }
    if (!result.success) {
      return textResult(
        `Failed to find UI elements: ${result.error}\nElectron fallback: ${electron.error ?? 'unknown'}\n\n${electron.activationHint ?? ''}`.trim(),
        true,
      );
    }
  }

  if (!result.success) {
    return textResult(`Failed to find UI elements: ${result.error}`, true);
  }

  if (result.elements.length === 0) {
    return textResult(`No UI elements found in ${app} matching the criteria.`);
  }

  return textResult(JSON.stringify({
    app,
    source: 'accessibility',
    count: result.elements.length,
    elements: result.elements,
  }, null, 2));
}

interface ElectronAxFilter {
  role?: string;
  title?: string;
  searchText?: string;
  maxResults: number;
}

/**
 * Apply find-ui-style filters to a CDP AX tree. CDP nodes use the same
 * conceptual fields but with different shapes — `{ role: { value: 'button' } }`
 * — so we normalize here. Kept exported-shape simple to avoid leaking CDP's
 * internals to MCP callers.
 */
function filterElectronAxTree(
  nodes: Array<Record<string, unknown>>,
  filter: ElectronAxFilter,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const node of nodes) {
    const role = pickValue(node.role);
    const name = pickValue(node.name);
    const description = pickValue(node.description);

    if (filter.role && role !== filter.role) continue;
    if (filter.title && name !== filter.title) continue;
    if (filter.searchText) {
      const needle = filter.searchText.toLowerCase();
      const haystack = `${name ?? ''} ${description ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) continue;
    }

    out.push({
      nodeId: node.nodeId,
      role,
      name,
      description,
      childCount: Array.isArray(node.childIds) ? node.childIds.length : 0,
    });
    if (out.length >= filter.maxResults) break;
  }
  return out;
}

function pickValue(field: unknown): string | undefined {
  if (field == null) return undefined;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && 'value' in (field as object)) {
    const v = (field as { value: unknown }).value;
    return typeof v === 'string' ? v : v == null ? undefined : String(v);
  }
  return undefined;
}
