import type { CallToolResult } from '../types.js';
import { textResult } from '../types.js';
import { runAppleScript } from '../engine/applescript.js';
import { z } from 'zod';

/**
 * Probe macOS TCC state by *attempting* a known-safe call and classifying the
 * resulting error. There's no public API to ask "do I have Accessibility?"
 * without doing something that needs it, so we do exactly that — once, lightly.
 *
 * For Screen Recording we don't probe (the only reliable check is to take a
 * screenshot, which is a heavyweight action). We return "unknown" + a hint.
 */

const SCHEMA = z.object({
  check: z.enum(['all', 'automation', 'accessibility', 'screen_recording']).default('all').optional(),
});

const PRIVACY_LINKS: Record<string, string> = {
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screen_recording: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
};

interface PermissionStatus {
  status: 'granted' | 'denied' | 'unknown';
  hint?: string;
  deepLink?: string;
}

function probeAutomation(): PermissionStatus {
  // System Events is the bellwether — almost every Mac-Pilot action that
  // needs Automation needs it through System Events.
  const r = runAppleScript('tell application "System Events" to return name of first process', 2500);
  if (r.success) return { status: 'granted' };
  if (/not authorized|not allowed/i.test(r.error ?? '')) {
    return {
      status: 'denied',
      hint: 'Grant Automation permission to your MCP client app for "System Events".',
      deepLink: PRIVACY_LINKS.automation,
    };
  }
  return { status: 'unknown', hint: r.error ?? 'Probe failed.' };
}

function probeAccessibility(): PermissionStatus {
  // `processes` access requires Accessibility on modern macOS.
  const r = runAppleScript('tell application "System Events" to return count of processes', 2500);
  if (r.success) return { status: 'granted' };
  if (/assistive access|accessibility/i.test(r.error ?? '')) {
    return {
      status: 'denied',
      hint: 'Grant Accessibility permission to your MCP client app.',
      deepLink: PRIVACY_LINKS.accessibility,
    };
  }
  // If Automation is denied we can't tell whether Accessibility is granted —
  // it never gets to that check. Surface that clearly.
  if (/not authorized|not allowed/i.test(r.error ?? '')) {
    return {
      status: 'unknown',
      hint: 'Automation permission is required first; Accessibility cannot be probed independently.',
    };
  }
  return { status: 'unknown', hint: r.error ?? 'Probe failed.' };
}

function probeScreenRecording(): PermissionStatus {
  // Triggering a real screencapture would be heavy and visible. Report
  // unknown with a deep-link so the model can ask the user.
  return {
    status: 'unknown',
    hint: 'Screen Recording state is not probed automatically (it would take a real screenshot). Verify manually in System Settings.',
    deepLink: PRIVACY_LINKS.screen_recording,
  };
}

export function handleMacPermissions(args: Record<string, unknown>): CallToolResult {
  const parsed = SCHEMA.safeParse(args);
  if (!parsed.success) return textResult(`Invalid parameters: ${parsed.error.message}`, true);
  const check = parsed.data.check ?? 'all';

  const result: Record<string, PermissionStatus> = {};
  if (check === 'all' || check === 'automation') result.automation = probeAutomation();
  if (check === 'all' || check === 'accessibility') result.accessibility = probeAccessibility();
  if (check === 'all' || check === 'screen_recording') result.screen_recording = probeScreenRecording();

  return textResult(JSON.stringify(result, null, 2));
}
