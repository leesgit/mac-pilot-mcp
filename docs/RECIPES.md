# Built-in Recipes

Mac-Pilot ships with **118 recipes** that are auto-loaded into the local
SQLite DB on first run. The LLM should call `mac_recipe_search` before
writing new AppleScript — most common macOS tasks are already covered.

> **Usage**: `mac_recipe_run({ name: "<recipe-name>", params: { ... } })`
> **Discovery**: `mac_recipe_search({ query: "<keywords>" })`

## Categories

- [Finder (16)](#finder)
- [Safari (14)](#safari)
- [Mail (8)](#mail)
- [Notes (7)](#notes)
- [Messages (6)](#messages)
- [Calendar (7)](#calendar)
- [Reminders (6)](#reminders)
- [Shortcuts (4)](#shortcuts)
- [System (23)](#system)
- [Productivity (9)](#productivity)
- [Music (5)](#music)
- [Clipboard / Notifications / Terminal / Window / Misc (13)](#misc)

---

## Finder

`empty-trash`, `new-finder-window`, `get-selected-files`,
`finder-new-folder`, `finder-get-info`, `finder-eject-all`,
`finder-show-hidden-files`, `finder-hide-hidden-files`,
`finder-reveal-in-finder`, `finder-quick-look`, `finder-compress-selection`,
`finder-airdrop-open`, `finder-sidebar-add-favorite`, `finder-add-tag`,
`finder-go-to-folder`, `finder-front-window-path`

## Safari

`safari-new-tab`, `safari-new-window`, `safari-reader-mode`,
`safari-save-as-pdf`, `safari-downloads-open`, `safari-history-open`,
`safari-bookmark-current`, `safari-private-window`, `safari-reload-tab`,
`safari-close-other-tabs`, `safari-reopen-closed-tab`,
`safari-find-in-page`, `safari-current-url`, `safari-current-title`

## Mail

`mail-compose`, `mail-send-quick`, `mail-search-mailbox`,
`mail-mark-read`, `mail-mark-unread`, `mail-archive-selection`,
`mail-flag-selection`, `mail-get-unread-count`

## Notes

`notes-create`, `notes-search`, `notes-append`, `notes-list-folders`,
`notes-share-current`, `notes-lock`, `notes-count`

## Messages

`messages-send`, `messages-open-app`, `messages-search`,
`messages-new-chat`, `messages-count-conversations`, `messages-send-file`

## Calendar

`calendar-create-event`, `calendar-list-today`, `calendar-search`,
`calendar-go-to-today`, `calendar-switch-view-day`,
`calendar-switch-view-week`, `calendar-switch-view-month`

## Reminders

`reminders-add`, `reminders-add-with-due`, `reminders-complete`,
`reminders-list-today`, `reminders-create-list`, `reminders-search`

## Shortcuts

`shortcuts-run`, `shortcuts-run-with-input`, `shortcuts-list`,
`shortcuts-open-app`

## System

`toggle-dark-mode`, `get-dark-mode`, `set-volume`, `lock-screen`,
`system-sleep-now`, `system-restart`, `system-mute`, `system-unmute`,
`mute-toggle`, `system-volume-up`, `system-volume-down`,
`system-wifi-on`, `system-wifi-off`, `system-toggle-wifi`,
`system-bluetooth-toggle`, `system-set-brightness`, `system-dnd-toggle`,
`system-notification-center`, `system-screensaver`,
`system-show-battery`, `system-frontmost-app`, `kill-process`,
`list-running-apps`

## Productivity

`spotlight-open`, `spotlight-search`, `app-switcher`,
`mission-control-open`, `launchpad-open`, `hide-others`,
`show-desktop`, `screenshot-window`, `screenshot-region`,
`screenshot-to-clipboard`

## Music

`music-play-pause`, `music-next-track`, `music-previous-track`,
`music-current-track`, `music-set-volume`

## Misc

- **Clipboard**: `get-clipboard`, `set-clipboard`
- **Notifications**: `notify`, `say-text`, `beep`, `date-now`
- **Terminal**: `open-terminal-at`
- **Windows**: `list-windows`, `minimize-front-window`,
  `close-front-window`
- **URLs**: `open-url`
- **Screenshots**: `screenshot-desktop` *(blocked by sandbox — use
  `screenshot-window`/`-region`/`-to-clipboard` instead)*

---

## Adding more

See [CONTRIBUTING.md](../CONTRIBUTING.md#contributing-a-recipe) for the
template + checklist. PRs adding well-tested recipes are merged quickly.

## Auto-learning

When you save a recipe via `mac_recipe_save`, it joins the same pool — the
search index covers built-ins and user recipes equally. Successful action
patterns are also tracked in the background, and the pattern-promotion query
(`getPromotionCandidates`) can suggest new recipes after the same operation
succeeds N times.
