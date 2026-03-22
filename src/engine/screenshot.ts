import { execSync } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logError } from '../utils/logger.js';

export interface ScreenshotResult {
  success: boolean;
  base64?: string;
  error?: string;
}

export function captureScreen(scale: number = 0.5): ScreenshotResult {
  return captureWithTool('screencapture', ['-x'], scale);
}

export function captureWindow(windowName: string, scale: number = 0.5): ScreenshotResult {
  // Use AppleScript to get window ID, then screencapture -l
  try {
    const windowId = execSync(
      `osascript -e 'tell application "System Events" to tell process "${windowName.replace(/"/g, '\\"')}" to get the id of window 1'`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (windowId) {
      return captureWithTool('screencapture', ['-x', '-l', windowId], scale);
    }
  } catch {
    // Fallback: try by window title with -l
  }

  // Fallback: capture full screen if window not found
  return {
    success: false,
    error: `Window not found for app: ${windowName}`,
  };
}

export function captureRegion(
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number = 0.5
): ScreenshotResult {
  return captureWithTool('screencapture', ['-x', '-R', `${x},${y},${width},${height}`], scale);
}

function captureWithTool(tool: string, args: string[], scale: number): ScreenshotResult {
  const tmpPath = join(tmpdir(), `mac-pilot-${Date.now()}.png`);

  try {
    execSync(`${tool} ${args.join(' ')} ${tmpPath}`, {
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const buffer = readFileSync(tmpPath);

    // Scale down if needed (use sips for macOS native resize)
    if (scale < 1.0) {
      try {
        const resizedPath = join(tmpdir(), `mac-pilot-resized-${Date.now()}.png`);
        const percentage = Math.round(scale * 100);
        execSync(
          `sips --resampleHeightWidthMax ${percentage}% ${tmpPath} --out ${resizedPath} 2>/dev/null`,
          { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        const resizedBuffer = readFileSync(resizedPath);
        try { unlinkSync(resizedPath); } catch { /* ignore */ }
        try { unlinkSync(tmpPath); } catch { /* ignore */ }
        return { success: true, base64: resizedBuffer.toString('base64') };
      } catch {
        // Fallback to unscaled
      }
    }

    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return { success: true, base64: buffer.toString('base64') };
  } catch (err) {
    logError('Screenshot failed', err);
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return { success: false, error: 'Screenshot capture failed' };
  }
}
