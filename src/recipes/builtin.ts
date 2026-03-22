/**
 * Built-in recipes that ship with Mac-Pilot.
 * These are auto-loaded on first run to solve the "cold start" problem.
 */

export interface BuiltinRecipe {
  name: string;
  description: string;
  app?: string;
  steps: Array<{
    actionType: string;
    params: Record<string, unknown>;
    description: string;
  }>;
  tags: string[];
}

export const BUILTIN_RECIPES: BuiltinRecipe[] = [
  // === System ===
  {
    name: 'toggle-dark-mode',
    description: 'Toggle macOS dark mode on/off',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to tell appearance preferences to set dark mode to not dark mode' },
        description: 'Toggle dark mode',
      },
    ],
    tags: ['system', 'dark-mode', 'appearance'],
  },
  {
    name: 'get-dark-mode',
    description: 'Check if dark mode is currently enabled',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to tell appearance preferences to get dark mode' },
        description: 'Get dark mode status',
      },
    ],
    tags: ['system', 'dark-mode', 'status'],
  },
  {
    name: 'set-volume',
    description: 'Set system volume to {{level}} (0-100)',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set volume output volume {{level}}' },
        description: 'Set volume level',
      },
    ],
    tags: ['system', 'volume', 'audio'],
  },
  {
    name: 'mute-toggle',
    description: 'Toggle system mute',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set curVolume to output muted of (get volume settings)\nset volume output muted (not curVolume)' },
        description: 'Toggle mute',
      },
    ],
    tags: ['system', 'mute', 'audio'],
  },
  {
    name: 'empty-trash',
    description: 'Empty the Trash',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to empty trash' },
        description: 'Empty trash',
      },
    ],
    tags: ['system', 'finder', 'trash', 'cleanup'],
  },
  {
    name: 'screenshot-desktop',
    description: 'Take a full screenshot and save to Desktop',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'screencapture ~/Desktop/screenshot-$(date +%Y%m%d-%H%M%S).png' },
        description: 'Capture full screen to Desktop',
      },
    ],
    tags: ['system', 'screenshot', 'capture'],
  },
  {
    name: 'lock-screen',
    description: 'Lock the screen immediately',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'pmset displaysleepnow' },
        description: 'Lock screen',
      },
    ],
    tags: ['system', 'lock', 'security'],
  },
  {
    name: 'show-desktop',
    description: 'Show desktop (minimize all windows)',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+F3' },
        description: 'Mission Control show desktop',
      },
    ],
    tags: ['system', 'desktop', 'windows'],
  },

  // === Finder ===
  {
    name: 'new-finder-window',
    description: 'Open a new Finder window at {{path}}',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to make new Finder window to folder (POSIX file "{{path}}")' },
        description: 'Open Finder at path',
      },
    ],
    tags: ['finder', 'window', 'navigate'],
  },
  {
    name: 'get-selected-files',
    description: 'Get paths of selected files in Finder',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to get POSIX path of (selection as alias list)' },
        description: 'Get selected file paths',
      },
    ],
    tags: ['finder', 'selection', 'files'],
  },

  // === Safari ===
  {
    name: 'safari-current-url',
    description: 'Get the current URL from Safari',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to get URL of current tab of front window' },
        description: 'Get current Safari URL',
      },
    ],
    tags: ['safari', 'browser', 'url'],
  },
  {
    name: 'safari-current-title',
    description: 'Get the page title from Safari',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to get name of current tab of front window' },
        description: 'Get current page title',
      },
    ],
    tags: ['safari', 'browser', 'title'],
  },

  // === Clipboard ===
  {
    name: 'get-clipboard',
    description: 'Get current clipboard contents',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'get the clipboard' },
        description: 'Read clipboard',
      },
    ],
    tags: ['clipboard', 'paste', 'copy'],
  },
  {
    name: 'set-clipboard',
    description: 'Set clipboard to {{text}}',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set the clipboard to "{{text}}"' },
        description: 'Set clipboard content',
      },
    ],
    tags: ['clipboard', 'copy'],
  },

  // === Notifications ===
  {
    name: 'notify',
    description: 'Show a macOS notification with title {{title}} and message {{message}}',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'display notification "{{message}}" with title "{{title}}"' },
        description: 'Show notification',
      },
    ],
    tags: ['notification', 'alert', 'message'],
  },

  // === Terminal / Dev ===
  {
    name: 'open-terminal-at',
    description: 'Open Terminal at {{path}}',
    app: 'Terminal',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Terminal" to do script "cd {{path}} && clear"' },
        description: 'Open Terminal at directory',
      },
    ],
    tags: ['terminal', 'dev', 'directory'],
  },
  {
    name: 'kill-process',
    description: 'Kill process by name {{processName}}',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "{{processName}}" to quit' },
        description: 'Quit application gracefully',
      },
    ],
    tags: ['process', 'quit', 'kill'],
  },

  // === Window Management ===
  {
    name: 'list-windows',
    description: 'List all windows of the frontmost app',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to get name of every window of first process whose frontmost is true' },
        description: 'List windows',
      },
    ],
    tags: ['windows', 'list', 'frontmost'],
  },
  {
    name: 'close-front-window',
    description: 'Close the frontmost window',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+w' },
        description: 'Close window',
      },
    ],
    tags: ['window', 'close'],
  },

  // === Music ===
  {
    name: 'music-play-pause',
    description: 'Toggle play/pause in Music app',
    app: 'Music',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Music" to playpause' },
        description: 'Toggle play/pause',
      },
    ],
    tags: ['music', 'play', 'pause', 'media'],
  },
  {
    name: 'music-next-track',
    description: 'Skip to next track in Music app',
    app: 'Music',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Music" to next track' },
        description: 'Next track',
      },
    ],
    tags: ['music', 'next', 'skip', 'media'],
  },
];
