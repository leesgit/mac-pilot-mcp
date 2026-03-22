import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacStateSchema } from '../schemas.js';
import { runAppleScript } from '../engine/applescript.js';

type StateField = 'frontmost_app' | 'windows' | 'clipboard' | 'selected_files' | 'running_apps';

const ALL_FIELDS: StateField[] = ['frontmost_app', 'windows', 'clipboard', 'selected_files', 'running_apps'];

export function handleMacState(args: Record<string, unknown>): CallToolResult {
  const parsed = MacStateSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const fields = (parsed.data.include as StateField[] | undefined) ?? ALL_FIELDS;
  const state: Record<string, unknown> = {};

  for (const field of fields) {
    switch (field) {
      case 'frontmost_app': {
        const result = runAppleScript(
          'tell application "System Events" to get name of first process whose frontmost is true'
        );
        state.frontmostApp = result.success ? result.output : `Error: ${result.error}`;
        break;
      }

      case 'windows': {
        const result = runAppleScript(`
          tell application "System Events"
            set windowList to {}
            repeat with proc in (every process whose visible is true)
              try
                repeat with win in (every window of proc)
                  set end of windowList to (name of proc) & ": " & (name of win)
                end repeat
              end try
            end repeat
            return windowList as text
          end tell
        `);
        state.windows = result.success ? result.output.split(', ').filter(Boolean) : [];
        break;
      }

      case 'clipboard': {
        const result = runAppleScript('the clipboard as text');
        state.clipboard = result.success ? result.output : null;
        break;
      }

      case 'selected_files': {
        const result = runAppleScript(`
          tell application "Finder"
            set selectedItems to selection as alias list
            set pathList to {}
            repeat with anItem in selectedItems
              set end of pathList to POSIX path of anItem
            end repeat
            return pathList as text
          end tell
        `);
        state.selectedFiles = result.success
          ? result.output.split(', ').filter(Boolean)
          : [];
        break;
      }

      case 'running_apps': {
        const result = runAppleScript(
          'tell application "System Events" to get name of every process whose background only is false'
        );
        state.runningApps = result.success
          ? result.output.split(', ').filter(Boolean)
          : [];
        break;
      }
    }
  }

  return textResult(JSON.stringify(state, null, 2));
}
