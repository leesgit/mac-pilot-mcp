import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { MacScreenshotSchema } from '../schemas.js';
import { captureScreen, captureWindow, captureRegion } from '../engine/screenshot.js';

export function handleMacScreenshot(args: Record<string, unknown>): CallToolResult {
  const parsed = MacScreenshotSchema.safeParse(args);
  if (!parsed.success) {
    return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  }

  const { target, windowName, region, scale } = parsed.data;
  const resolvedScale = scale ?? 0.5;

  let result;

  switch (target) {
    case 'screen':
      result = captureScreen(resolvedScale);
      break;
    case 'window':
      result = captureWindow(windowName!, resolvedScale);
      break;
    case 'region':
      result = captureRegion(region!.x, region!.y, region!.width, region!.height, resolvedScale);
      break;
    default:
      return textResult(`Unknown target: ${target}`, true);
  }

  if (!result.success) {
    return textResult(`Screenshot failed: ${result.error}`, true);
  }

  return {
    content: [{
      type: 'image' as const,
      data: result.base64!,
      mimeType: 'image/png',
    }],
  };
}
