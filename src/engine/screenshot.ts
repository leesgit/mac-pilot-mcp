import { execSync } from 'child_process';
import crypto from 'crypto';
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
  const tmpPath = join(tmpdir(), `mac-pilot-${crypto.randomUUID()}.png`);

  try {
    execSync(`${tool} ${args.join(' ')} ${tmpPath}`, {
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const buffer = readFileSync(tmpPath);

    // Scale down if needed (use sips for macOS native resize)
    if (scale < 1.0) {
      try {
        const resizedPath = join(tmpdir(), `mac-pilot-resized-${crypto.randomUUID()}.png`);
        // sips --resampleHeightWidthMax expects pixels, not percentage
        // Read original dimensions and compute target max dimension
        const sizeOutput = execSync(
          `sips -g pixelWidth -g pixelHeight ${tmpPath} 2>/dev/null`,
          { encoding: 'utf-8', timeout: 5000 }
        );
        const widthMatch = sizeOutput.match(/pixelWidth:\s*(\d+)/);
        const heightMatch = sizeOutput.match(/pixelHeight:\s*(\d+)/);
        const maxDim = Math.max(
          parseInt(widthMatch?.[1] ?? '1920', 10),
          parseInt(heightMatch?.[1] ?? '1080', 10),
        );
        const targetMax = Math.round(maxDim * scale);

        execSync(
          `sips --resampleHeightWidthMax ${targetMax} ${tmpPath} --out ${resizedPath} 2>/dev/null`,
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
