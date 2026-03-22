import { runJxa } from './applescript.js';

export interface UIElement {
  role: string;
  title: string;
  description: string;
  position: { x: number; y: number } | null;
  size: { width: number; height: number } | null;
  enabled: boolean;
  focused: boolean;
}

export function findUIElements(
  app: string,
  options?: { role?: string; title?: string; searchText?: string; maxResults?: number }
): { success: boolean; elements: UIElement[]; error?: string } {
  const maxResults = options?.maxResults ?? 10;

  // Build JXA script to query UI elements
  const filterParts: string[] = [];
  if (options?.role) filterParts.push(`el.role() === '${options.role}'`);
  if (options?.title) filterParts.push(`el.title() === '${options.title}'`);
  if (options?.searchText) {
    const escaped = options.searchText.replace(/'/g, "\\'");
    filterParts.push(`(el.title() && el.title().toLowerCase().includes('${escaped.toLowerCase()}')) || (el.description() && el.description().toLowerCase().includes('${escaped.toLowerCase()}'))`);
  }

  const filterExpr = filterParts.length > 0 ? filterParts.join(' && ') : 'true';

  const jxaScript = `
    (() => {
      const app = Application('System Events');
      const proc = app.processes.byName('${app.replace(/'/g, "\\'")}');

      if (!proc.exists()) return JSON.stringify({ error: 'Application not found or not running' });

      const results = [];
      const windows = proc.windows();

      for (const win of windows) {
        try {
          const elements = win.entireContents();
          for (const el of elements) {
            try {
              if (${filterExpr}) {
                let pos = null, sz = null;
                try { pos = { x: el.position()[0], y: el.position()[1] }; } catch(e) {}
                try { sz = { width: el.size()[0], height: el.size()[1] }; } catch(e) {}

                results.push({
                  role: el.role() || '',
                  title: el.title() || '',
                  description: el.description() || '',
                  position: pos,
                  size: sz,
                  enabled: el.enabled ? el.enabled() : true,
                  focused: el.focused ? el.focused() : false
                });

                if (results.length >= ${maxResults}) break;
              }
            } catch(e) { continue; }
          }
        } catch(e) { continue; }
        if (results.length >= ${maxResults}) break;
      }

      return JSON.stringify({ elements: results });
    })()
  `.trim();

  const result = runJxa(jxaScript, 15000);

  if (!result.success) {
    return { success: false, elements: [], error: result.error };
  }

  try {
    const parsed = JSON.parse(result.output);
    if (parsed.error) {
      return { success: false, elements: [], error: parsed.error };
    }
    return { success: true, elements: parsed.elements ?? [] };
  } catch {
    return { success: false, elements: [], error: 'Failed to parse UI element response' };
  }
}
