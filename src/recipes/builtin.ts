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

  // ============================================================
  // === Finder (extended) ===
  // ============================================================
  {
    name: 'finder-new-folder',
    description: 'Create a new folder named {{folderName}} inside {{parentPath}}',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to make new folder at (POSIX file "{{parentPath}}") with properties {name:"{{folderName}}"}' },
        description: 'Make new folder',
      },
    ],
    tags: ['finder', 'folder', 'create', 'new'],
  },
  {
    name: 'finder-get-info',
    description: 'Show the Get Info window for the currently selected Finder item',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to open information window of selection' },
        description: 'Open Get Info on selection',
      },
    ],
    tags: ['finder', 'info', 'metadata'],
  },
  {
    name: 'finder-eject-all',
    description: 'Eject all mounted external disks',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to eject (every disk whose ejectable is true)' },
        description: 'Eject all ejectable disks',
      },
    ],
    tags: ['finder', 'eject', 'disk', 'usb'],
  },
  {
    name: 'finder-show-hidden-files',
    description: 'Show hidden files in Finder (toggles AppleShowAllFiles and relaunches Finder)',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'do shell script "defaults write com.apple.finder AppleShowAllFiles -bool true && killall Finder"' },
        description: 'Enable hidden file visibility',
      },
    ],
    tags: ['finder', 'hidden', 'dotfiles', 'show'],
  },
  {
    name: 'finder-hide-hidden-files',
    description: 'Hide hidden files in Finder',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'do shell script "defaults write com.apple.finder AppleShowAllFiles -bool false && killall Finder"' },
        description: 'Disable hidden file visibility',
      },
    ],
    tags: ['finder', 'hidden', 'dotfiles', 'hide'],
  },
  {
    name: 'finder-reveal-in-finder',
    description: 'Reveal {{path}} in Finder (highlight the file)',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder"\nactivate\nreveal (POSIX file "{{path}}") as alias\nend tell' },
        description: 'Reveal file in Finder',
      },
    ],
    tags: ['finder', 'reveal', 'show'],
  },
  {
    name: 'finder-quick-look',
    description: 'Open Quick Look preview for {{path}}',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'qlmanage -p "{{path}}"' },
        description: 'Quick Look the file',
      },
    ],
    tags: ['finder', 'preview', 'quicklook'],
  },
  {
    name: 'finder-compress-selection',
    description: 'Create an archive of the currently selected Finder items',
    app: 'Finder',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+ctrl+a' },
        description: 'Trigger Finder Compress shortcut (set in Keyboard prefs) — fallback uses Services menu',
      },
    ],
    tags: ['finder', 'compress', 'archive', 'zip'],
  },
  {
    name: 'finder-airdrop-open',
    description: 'Open the AirDrop window in Finder',
    app: 'Finder',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'open -a Finder airdrop://' },
        description: 'Open AirDrop',
      },
    ],
    tags: ['finder', 'airdrop', 'share'],
  },
  {
    name: 'finder-sidebar-add-favorite',
    description: 'Add {{path}} to the Finder sidebar Favorites (uses sfltool)',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'mysides add "{{name}}" "file://{{path}}"' },
        description: 'Add to Favorites (requires brew install mysides)',
      },
    ],
    tags: ['finder', 'sidebar', 'favorite', 'bookmark'],
  },
  {
    name: 'finder-add-tag',
    description: 'Add tag {{tag}} to file {{path}}',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'xattr -w com.apple.metadata:_kMDItemUserTags "({{tag}})" "{{path}}"' },
        description: 'Apply Finder tag via xattr',
      },
    ],
    tags: ['finder', 'tag', 'metadata'],
  },
  {
    name: 'finder-go-to-folder',
    description: 'Open the "Go to Folder" dialog in Finder',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to activate' },
        description: 'Bring Finder to front',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+shift+g' },
        description: 'Open Go to Folder',
      },
    ],
    tags: ['finder', 'navigate', 'goto'],
  },
  {
    name: 'finder-front-window-path',
    description: 'Get the POSIX path of the front Finder window',
    app: 'Finder',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Finder" to get POSIX path of (target of front window as alias)' },
        description: 'Get front Finder window path',
      },
    ],
    tags: ['finder', 'path', 'window'],
  },

  // ============================================================
  // === Safari (extended) ===
  // ============================================================
  {
    name: 'safari-new-tab',
    description: 'Open a new tab in Safari at {{url}}',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari"\nactivate\ntell front window to set current tab to (make new tab with properties {URL:"{{url}}"})\nend tell' },
        description: 'Open new tab with URL',
      },
    ],
    tags: ['safari', 'browser', 'tab', 'open'],
  },
  {
    name: 'safari-new-window',
    description: 'Open a new Safari window at {{url}}',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari"\nactivate\nmake new document with properties {URL:"{{url}}"}\nend tell' },
        description: 'Open new Safari window',
      },
    ],
    tags: ['safari', 'browser', 'window'],
  },
  {
    name: 'safari-reader-mode',
    description: 'Toggle Reader Mode for the current Safari tab',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+shift+r' },
        description: 'Toggle Reader',
      },
    ],
    tags: ['safari', 'reader', 'read'],
  },
  {
    name: 'safari-save-as-pdf',
    description: 'Open the Print dialog so the current tab can be saved as PDF',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+p' },
        description: 'Open Print/Save-as-PDF dialog',
      },
    ],
    tags: ['safari', 'pdf', 'export', 'print'],
  },
  {
    name: 'safari-downloads-open',
    description: 'Open the Safari downloads list',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+alt+l' },
        description: 'Open Downloads',
      },
    ],
    tags: ['safari', 'downloads'],
  },
  {
    name: 'safari-history-open',
    description: 'Open Safari History window',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+y' },
        description: 'Show History',
      },
    ],
    tags: ['safari', 'history'],
  },
  {
    name: 'safari-bookmark-current',
    description: 'Bookmark the current Safari tab (opens the Add Bookmark sheet)',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+d' },
        description: 'Add bookmark',
      },
    ],
    tags: ['safari', 'bookmark', 'save'],
  },
  {
    name: 'safari-private-window',
    description: 'Open a new private Safari window',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+shift+n' },
        description: 'New private window',
      },
    ],
    tags: ['safari', 'private', 'incognito'],
  },
  {
    name: 'safari-reload-tab',
    description: 'Reload the current Safari tab',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari"\nset URL of current tab of front window to (URL of current tab of front window)\nend tell' },
        description: 'Reload current tab',
      },
    ],
    tags: ['safari', 'reload', 'refresh'],
  },
  {
    name: 'safari-close-other-tabs',
    description: 'Close all Safari tabs except the current one',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari"\nactivate\ntell front window\nset curTab to current tab\nset tabsToClose to (every tab whose index is not (index of curTab))\nrepeat with t in tabsToClose\nclose t\nend repeat\nend tell\nend tell' },
        description: 'Close all other tabs',
      },
    ],
    tags: ['safari', 'tabs', 'close'],
  },
  {
    name: 'safari-reopen-closed-tab',
    description: 'Reopen the last closed Safari tab',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+shift+t' },
        description: 'Reopen last closed tab',
      },
    ],
    tags: ['safari', 'tab', 'reopen', 'restore'],
  },
  {
    name: 'safari-find-in-page',
    description: 'Open the in-page Find bar in Safari',
    app: 'Safari',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Safari" to activate' },
        description: 'Focus Safari',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+f' },
        description: 'Open Find bar',
      },
    ],
    tags: ['safari', 'find', 'search', 'page'],
  },

  // ============================================================
  // === Mail ===
  // ============================================================
  {
    name: 'mail-compose',
    description: 'Compose a new email to {{recipient}} with subject {{subject}} and body {{body}}',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail"\nset newMsg to make new outgoing message with properties {subject:"{{subject}}", content:"{{body}}", visible:true}\ntell newMsg\nmake new to recipient at end of to recipients with properties {address:"{{recipient}}"}\nend tell\nactivate\nend tell' },
        description: 'Compose new message',
      },
    ],
    tags: ['mail', 'email', 'compose'],
  },
  {
    name: 'mail-send-quick',
    description: 'Compose and immediately send an email to {{recipient}}',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail"\nset newMsg to make new outgoing message with properties {subject:"{{subject}}", content:"{{body}}", visible:false}\ntell newMsg\nmake new to recipient at end of to recipients with properties {address:"{{recipient}}"}\nsend\nend tell\nend tell' },
        description: 'Compose and send',
      },
    ],
    tags: ['mail', 'email', 'send'],
  },
  {
    name: 'mail-search-mailbox',
    description: 'Search Mail for {{query}}',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail" to activate' },
        description: 'Focus Mail',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+alt+f' },
        description: 'Open Mail search',
      },
      {
        actionType: 'type',
        params: { text: '{{query}}' },
        description: 'Type query',
      },
    ],
    tags: ['mail', 'search', 'email'],
  },
  {
    name: 'mail-mark-read',
    description: 'Mark the selected Mail messages as read',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail"\nrepeat with m in (get selection)\nset read status of m to true\nend repeat\nend tell' },
        description: 'Mark selected as read',
      },
    ],
    tags: ['mail', 'read', 'status'],
  },
  {
    name: 'mail-mark-unread',
    description: 'Mark the selected Mail messages as unread',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail"\nrepeat with m in (get selection)\nset read status of m to false\nend repeat\nend tell' },
        description: 'Mark selected as unread',
      },
    ],
    tags: ['mail', 'unread', 'status'],
  },
  {
    name: 'mail-archive-selection',
    description: 'Archive the selected Mail messages (Cmd+Ctrl+A keyboard shortcut)',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail" to activate' },
        description: 'Focus Mail',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+ctrl+a' },
        description: 'Archive selection',
      },
    ],
    tags: ['mail', 'archive'],
  },
  {
    name: 'mail-flag-selection',
    description: 'Flag the selected Mail messages with the default color',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail"\nrepeat with m in (get selection)\nset flag index of m to 0\nend repeat\nend tell' },
        description: 'Flag selected messages',
      },
    ],
    tags: ['mail', 'flag'],
  },
  {
    name: 'mail-get-unread-count',
    description: 'Get the total number of unread Mail messages across all inboxes',
    app: 'Mail',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Mail" to get unread count of inbox' },
        description: 'Read unread count',
      },
    ],
    tags: ['mail', 'unread', 'count', 'inbox'],
  },

  // ============================================================
  // === Notes ===
  // ============================================================
  {
    name: 'notes-create',
    description: 'Create a new note with title {{title}} and body {{body}}',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes"\nactivate\nmake new note with properties {name:"{{title}}", body:"{{body}}"}\nend tell' },
        description: 'Create note',
      },
    ],
    tags: ['notes', 'create', 'note'],
  },
  {
    name: 'notes-search',
    description: 'Search Notes for {{query}}',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes" to activate' },
        description: 'Focus Notes',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+alt+f' },
        description: 'Open Notes search',
      },
      {
        actionType: 'type',
        params: { text: '{{query}}' },
        description: 'Type query',
      },
    ],
    tags: ['notes', 'search'],
  },
  {
    name: 'notes-append',
    description: 'Append {{text}} to the note titled {{title}}',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes"\nset matches to notes whose name is "{{title}}"\nif (count of matches) > 0 then\nset n to item 1 of matches\nset body of n to (body of n) & "<br>{{text}}"\nend if\nend tell' },
        description: 'Append to existing note',
      },
    ],
    tags: ['notes', 'append', 'edit'],
  },
  {
    name: 'notes-list-folders',
    description: 'List all Notes folders',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes" to get name of every folder' },
        description: 'Get folder names',
      },
    ],
    tags: ['notes', 'folders', 'list'],
  },
  {
    name: 'notes-share-current',
    description: 'Open the Share menu for the currently selected note',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes" to activate' },
        description: 'Focus Notes',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+shift+s' },
        description: 'Open share sheet',
      },
    ],
    tags: ['notes', 'share'],
  },
  {
    name: 'notes-lock',
    description: 'Lock the currently selected note (requires Notes password set up)',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes" to activate' },
        description: 'Focus Notes',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+ctrl+l' },
        description: 'Toggle note lock',
      },
    ],
    tags: ['notes', 'lock', 'security'],
  },
  {
    name: 'notes-count',
    description: 'Get the total count of notes',
    app: 'Notes',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Notes" to count of notes' },
        description: 'Count notes',
      },
    ],
    tags: ['notes', 'count'],
  },

  // ============================================================
  // === Messages ===
  // ============================================================
  {
    name: 'messages-send',
    description: 'Send iMessage {{body}} to {{recipient}}',
    app: 'Messages',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Messages"\nset targetService to 1st service whose service type = iMessage\nset targetBuddy to buddy "{{recipient}}" of targetService\nsend "{{body}}" to targetBuddy\nend tell' },
        description: 'Send iMessage',
      },
    ],
    tags: ['messages', 'imessage', 'send', 'chat'],
  },
  {
    name: 'messages-open-app',
    description: 'Open Messages app and bring to front',
    app: 'Messages',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Messages" to activate' },
        description: 'Activate Messages',
      },
    ],
    tags: ['messages', 'open', 'app'],
  },
  {
    name: 'messages-search',
    description: 'Open Messages search and type {{query}}',
    app: 'Messages',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Messages" to activate' },
        description: 'Focus Messages',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+f' },
        description: 'Open search',
      },
      {
        actionType: 'type',
        params: { text: '{{query}}' },
        description: 'Type query',
      },
    ],
    tags: ['messages', 'search'],
  },
  {
    name: 'messages-new-chat',
    description: 'Start a new Messages conversation (opens new message window)',
    app: 'Messages',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Messages" to activate' },
        description: 'Focus Messages',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+n' },
        description: 'New chat',
      },
    ],
    tags: ['messages', 'new', 'chat'],
  },
  {
    name: 'messages-count-conversations',
    description: 'Get the count of open Messages conversations',
    app: 'Messages',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Messages" to count of chats' },
        description: 'Count chats',
      },
    ],
    tags: ['messages', 'count', 'chats'],
  },
  {
    name: 'messages-send-file',
    description: 'Send file at {{path}} to {{recipient}} via iMessage',
    app: 'Messages',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Messages"\nset targetService to 1st service whose service type = iMessage\nset targetBuddy to buddy "{{recipient}}" of targetService\nsend (POSIX file "{{path}}") to targetBuddy\nend tell' },
        description: 'Send file',
      },
    ],
    tags: ['messages', 'imessage', 'attach', 'file'],
  },

  // ============================================================
  // === Calendar ===
  // ============================================================
  {
    name: 'calendar-create-event',
    description: 'Create a Calendar event titled {{title}} starting {{startDate}} (format: M/D/YYYY h:m AM) for {{durationMinutes}} minutes',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Calendar"\nset startD to date "{{startDate}}"\nset endD to startD + ({{durationMinutes}} * minutes)\ntell calendar 1\nmake new event with properties {summary:"{{title}}", start date:startD, end date:endD}\nend tell\nend tell' },
        description: 'Create event in first calendar',
      },
    ],
    tags: ['calendar', 'event', 'create'],
  },
  {
    name: 'calendar-list-today',
    description: 'List all events occurring today across visible calendars',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set today to current date\nset hours of today to 0\nset minutes of today to 0\nset seconds of today to 0\nset tomorrow to today + (1 * days)\ntell application "Calendar"\nset out to {}\nrepeat with c in calendars\nset evs to (every event of c whose start date is greater than or equal to today and start date is less than tomorrow)\nrepeat with e in evs\nset end of out to (summary of e) & " @ " & (start date of e as string)\nend repeat\nend repeat\nreturn out\nend tell' },
        description: 'List today events',
      },
    ],
    tags: ['calendar', 'today', 'events', 'list'],
  },
  {
    name: 'calendar-search',
    description: 'Open Calendar and search for events matching {{query}}',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Calendar" to activate' },
        description: 'Focus Calendar',
      },
      {
        actionType: 'keypress',
        params: { text: 'cmd+f' },
        description: 'Open search',
      },
      {
        actionType: 'type',
        params: { text: '{{query}}' },
        description: 'Type query',
      },
    ],
    tags: ['calendar', 'search', 'event'],
  },
  {
    name: 'calendar-go-to-today',
    description: 'Jump to today in Calendar',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Calendar" to view calendar at (current date)' },
        description: 'View today',
      },
    ],
    tags: ['calendar', 'today', 'navigate'],
  },
  {
    name: 'calendar-switch-view-day',
    description: 'Switch Calendar to Day view',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Calendar"\nactivate\ntell application "System Events" to keystroke "1" using {command down}\nend tell' },
        description: 'Day view',
      },
    ],
    tags: ['calendar', 'view', 'day'],
  },
  {
    name: 'calendar-switch-view-week',
    description: 'Switch Calendar to Week view',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Calendar"\nactivate\ntell application "System Events" to keystroke "2" using {command down}\nend tell' },
        description: 'Week view',
      },
    ],
    tags: ['calendar', 'view', 'week'],
  },
  {
    name: 'calendar-switch-view-month',
    description: 'Switch Calendar to Month view',
    app: 'Calendar',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Calendar"\nactivate\ntell application "System Events" to keystroke "3" using {command down}\nend tell' },
        description: 'Month view',
      },
    ],
    tags: ['calendar', 'view', 'month'],
  },

  // ============================================================
  // === Reminders ===
  // ============================================================
  {
    name: 'reminders-add',
    description: 'Add a reminder named {{title}} to the default list',
    app: 'Reminders',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Reminders"\nmake new reminder with properties {name:"{{title}}"}\nend tell' },
        description: 'Create reminder',
      },
    ],
    tags: ['reminders', 'add', 'task'],
  },
  {
    name: 'reminders-add-with-due',
    description: 'Add a reminder named {{title}} with due date {{dueDate}} (format: M/D/YYYY h:m AM)',
    app: 'Reminders',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Reminders"\nmake new reminder with properties {name:"{{title}}", due date:date "{{dueDate}}"}\nend tell' },
        description: 'Create reminder with due date',
      },
    ],
    tags: ['reminders', 'add', 'due', 'task'],
  },
  {
    name: 'reminders-complete',
    description: 'Mark reminder titled {{title}} as completed',
    app: 'Reminders',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Reminders"\nset matches to reminders whose name is "{{title}}"\nrepeat with r in matches\nset completed of r to true\nend repeat\nend tell' },
        description: 'Mark complete',
      },
    ],
    tags: ['reminders', 'complete', 'done'],
  },
  {
    name: 'reminders-list-today',
    description: 'List all reminders due today',
    app: 'Reminders',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set today to current date\nset hours of today to 0\nset minutes of today to 0\nset seconds of today to 0\nset tomorrow to today + (1 * days)\ntell application "Reminders"\nset out to {}\nrepeat with r in (reminders whose completed is false and due date is greater than or equal to today and due date is less than tomorrow)\nset end of out to name of r\nend repeat\nreturn out\nend tell' },
        description: 'Today reminders',
      },
    ],
    tags: ['reminders', 'today', 'list'],
  },
  {
    name: 'reminders-create-list',
    description: 'Create a new Reminders list named {{listName}}',
    app: 'Reminders',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Reminders"\nmake new list with properties {name:"{{listName}}"}\nend tell' },
        description: 'Create list',
      },
    ],
    tags: ['reminders', 'list', 'create'],
  },
  {
    name: 'reminders-search',
    description: 'Search reminders containing {{query}}',
    app: 'Reminders',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Reminders"\nset out to {}\nrepeat with r in (reminders whose name contains "{{query}}")\nset end of out to name of r\nend repeat\nreturn out\nend tell' },
        description: 'Search reminders',
      },
    ],
    tags: ['reminders', 'search'],
  },

  // ============================================================
  // === Shortcuts ===
  // ============================================================
  {
    name: 'shortcuts-run',
    description: 'Run the macOS Shortcut named {{shortcutName}}',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'shortcuts run "{{shortcutName}}"' },
        description: 'Run Shortcut by name',
      },
    ],
    tags: ['shortcuts', 'automation', 'run'],
  },
  {
    name: 'shortcuts-run-with-input',
    description: 'Run Shortcut {{shortcutName}} with stdin input {{input}}',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'echo "{{input}}" | shortcuts run "{{shortcutName}}"' },
        description: 'Run Shortcut with piped input',
      },
    ],
    tags: ['shortcuts', 'automation', 'input'],
  },
  {
    name: 'shortcuts-list',
    description: 'List all available Shortcuts',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'shortcuts list' },
        description: 'List shortcuts',
      },
    ],
    tags: ['shortcuts', 'list'],
  },
  {
    name: 'shortcuts-open-app',
    description: 'Open the Shortcuts application',
    app: 'Shortcuts',
    steps: [
      {
        actionType: 'open',
        params: { target: 'Shortcuts' },
        description: 'Open Shortcuts app',
      },
    ],
    tags: ['shortcuts', 'app', 'open'],
  },

  // ============================================================
  // === System (extended) ===
  // ============================================================
  {
    name: 'system-sleep-now',
    description: 'Put the Mac to sleep immediately',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to sleep' },
        description: 'Sleep',
      },
    ],
    tags: ['system', 'sleep', 'power'],
  },
  {
    name: 'system-restart',
    description: 'Restart the Mac (will prompt to save documents)',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to restart' },
        description: 'Restart',
      },
    ],
    tags: ['system', 'restart', 'reboot'],
  },
  {
    name: 'system-mute',
    description: 'Mute system audio output',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set volume output muted true' },
        description: 'Mute',
      },
    ],
    tags: ['system', 'mute', 'audio', 'volume'],
  },
  {
    name: 'system-unmute',
    description: 'Unmute system audio output',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set volume output muted false' },
        description: 'Unmute',
      },
    ],
    tags: ['system', 'unmute', 'audio', 'volume'],
  },
  {
    name: 'system-volume-up',
    description: 'Increase system volume by 10',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set curVol to output volume of (get volume settings)\nset volume output volume (curVol + 10)' },
        description: 'Volume +10',
      },
    ],
    tags: ['system', 'volume', 'up'],
  },
  {
    name: 'system-volume-down',
    description: 'Decrease system volume by 10',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'set curVol to output volume of (get volume settings)\nset volume output volume (curVol - 10)' },
        description: 'Volume -10',
      },
    ],
    tags: ['system', 'volume', 'down'],
  },
  {
    name: 'system-set-brightness',
    description: 'Set display brightness to {{percent}} percent (0-100) via brightness keystroke',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'brightness {{percent}}' },
        description: 'Set brightness (requires brew install brightness)',
      },
    ],
    tags: ['system', 'brightness', 'display'],
  },
  {
    name: 'system-toggle-wifi',
    description: 'Toggle Wi-Fi power (uses networksetup, asks for credentials if locked)',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'networksetup -setairportpower en0 off && networksetup -setairportpower en0 on' },
        description: 'Cycle Wi-Fi',
      },
    ],
    tags: ['system', 'wifi', 'network', 'toggle'],
  },
  {
    name: 'system-wifi-on',
    description: 'Turn Wi-Fi on',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'networksetup -setairportpower en0 on' },
        description: 'Wi-Fi on',
      },
    ],
    tags: ['system', 'wifi', 'on'],
  },
  {
    name: 'system-wifi-off',
    description: 'Turn Wi-Fi off',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'networksetup -setairportpower en0 off' },
        description: 'Wi-Fi off',
      },
    ],
    tags: ['system', 'wifi', 'off'],
  },
  {
    name: 'system-bluetooth-toggle',
    description: 'Toggle Bluetooth power (requires blueutil installed via brew)',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'blueutil --power toggle' },
        description: 'Toggle Bluetooth',
      },
    ],
    tags: ['system', 'bluetooth', 'toggle'],
  },
  {
    name: 'system-dnd-toggle',
    description: 'Toggle Do Not Disturb / Focus mode via Shortcuts',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'shortcuts run "Toggle Do Not Disturb"' },
        description: 'Toggle DND',
      },
    ],
    tags: ['system', 'dnd', 'focus', 'toggle'],
  },
  {
    name: 'system-notification-center',
    description: 'Open Notification Center',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to tell process "ControlCenter" to click menu bar item "Control Center" of menu bar 1' },
        description: 'Open Control/Notification Center',
      },
    ],
    tags: ['system', 'notification', 'center'],
  },
  {
    name: 'system-screensaver',
    description: 'Start the screensaver',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'open -a ScreenSaverEngine' },
        description: 'Start screensaver',
      },
    ],
    tags: ['system', 'screensaver', 'lock'],
  },
  {
    name: 'system-show-battery',
    description: 'Show battery percentage and status',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'pmset -g batt' },
        description: 'Battery status',
      },
    ],
    tags: ['system', 'battery', 'power'],
  },
  {
    name: 'system-frontmost-app',
    description: 'Get the name of the frontmost application',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to get name of first process whose frontmost is true' },
        description: 'Read frontmost app',
      },
    ],
    tags: ['system', 'frontmost', 'app'],
  },

  // ============================================================
  // === Productivity ===
  // ============================================================
  {
    name: 'spotlight-open',
    description: 'Open Spotlight search',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+space' },
        description: 'Open Spotlight',
      },
    ],
    tags: ['spotlight', 'search', 'launcher'],
  },
  {
    name: 'spotlight-search',
    description: 'Open Spotlight and search for {{query}}',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+space' },
        description: 'Open Spotlight',
      },
      {
        actionType: 'type',
        params: { text: '{{query}}' },
        description: 'Type query',
      },
    ],
    tags: ['spotlight', 'search'],
  },
  {
    name: 'app-switcher',
    description: 'Open the Cmd+Tab application switcher',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+tab' },
        description: 'App switcher',
      },
    ],
    tags: ['app', 'switcher', 'switch'],
  },
  {
    name: 'mission-control-open',
    description: 'Open Mission Control',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'ctrl+up' },
        description: 'Mission Control',
      },
    ],
    tags: ['mission-control', 'spaces', 'windows'],
  },
  {
    name: 'launchpad-open',
    description: 'Open Launchpad',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'open -a Launchpad' },
        description: 'Open Launchpad',
      },
    ],
    tags: ['launchpad', 'apps'],
  },
  {
    name: 'hide-others',
    description: 'Hide all applications except the frontmost',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+alt+h' },
        description: 'Hide others',
      },
    ],
    tags: ['window', 'hide', 'focus'],
  },
  {
    name: 'minimize-front-window',
    description: 'Minimize the frontmost window to the Dock',
    steps: [
      {
        actionType: 'keypress',
        params: { text: 'cmd+m' },
        description: 'Minimize window',
      },
    ],
    tags: ['window', 'minimize'],
  },
  {
    name: 'screenshot-window',
    description: 'Take a screenshot of a selected window and save to Desktop',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'screencapture -W -o ~/Desktop/window-screenshot.png' },
        description: 'Window screenshot (click window when crosshair appears)',
      },
    ],
    tags: ['screenshot', 'window', 'capture'],
  },
  {
    name: 'screenshot-region',
    description: 'Take a screenshot of a selected region and save to Desktop',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'screencapture -i ~/Desktop/region-screenshot.png' },
        description: 'Region screenshot (drag to select)',
      },
    ],
    tags: ['screenshot', 'region', 'capture'],
  },
  {
    name: 'screenshot-to-clipboard',
    description: 'Take a region screenshot and copy it to the clipboard',
    steps: [
      {
        actionType: 'shell',
        params: { command: 'screencapture -i -c' },
        description: 'Region screenshot to clipboard',
      },
    ],
    tags: ['screenshot', 'clipboard', 'capture'],
  },

  // ============================================================
  // === Music (extended) ===
  // ============================================================
  {
    name: 'music-previous-track',
    description: 'Skip to previous track in Music',
    app: 'Music',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Music" to previous track' },
        description: 'Previous track',
      },
    ],
    tags: ['music', 'previous', 'media'],
  },
  {
    name: 'music-current-track',
    description: 'Get the currently playing track name and artist from Music',
    app: 'Music',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Music"\nif player state is playing then\nreturn (name of current track) & " - " & (artist of current track)\nelse\nreturn "Not playing"\nend if\nend tell' },
        description: 'Read current track',
      },
    ],
    tags: ['music', 'current', 'now-playing'],
  },
  {
    name: 'music-set-volume',
    description: 'Set Music app volume to {{level}} (0-100)',
    app: 'Music',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "Music" to set sound volume to {{level}}' },
        description: 'Set Music volume',
      },
    ],
    tags: ['music', 'volume', 'audio'],
  },

  // ============================================================
  // === Misc Utilities ===
  // ============================================================
  {
    name: 'open-url',
    description: 'Open {{url}} in the default browser',
    steps: [
      {
        actionType: 'open',
        params: { target: '{{url}}' },
        description: 'Open URL',
      },
    ],
    tags: ['url', 'browser', 'open'],
  },
  {
    name: 'say-text',
    description: 'Speak {{text}} aloud using the system TTS voice',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'say "{{text}}"' },
        description: 'Speak text',
      },
    ],
    tags: ['speech', 'tts', 'say'],
  },
  {
    name: 'beep',
    description: 'Play the system beep sound',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'beep' },
        description: 'Play beep',
      },
    ],
    tags: ['beep', 'sound', 'alert'],
  },
  {
    name: 'date-now',
    description: 'Get the current date and time',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'return current date as string' },
        description: 'Current date',
      },
    ],
    tags: ['date', 'time', 'now'],
  },
  {
    name: 'list-running-apps',
    description: 'List all running applications',
    steps: [
      {
        actionType: 'applescript',
        params: { script: 'tell application "System Events" to get name of every application process whose background only is false' },
        description: 'List visible running apps',
      },
    ],
    tags: ['apps', 'running', 'list'],
  },
];
