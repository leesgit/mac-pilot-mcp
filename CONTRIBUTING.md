# Contributing to Mac-Pilot MCP

Thanks for considering a contribution. The two most useful things to send
are **new built-in recipes** and **bug reports with reproduction steps**.

## Development setup

```bash
git clone https://github.com/leesgit/mac-pilot-mcp.git
cd mac-pilot-mcp
npm install
npm run build
npm test
```

Tests run on every push via GitHub Actions across macOS 13/14/15 and Node 20/22.

## Contributing a recipe

Recipes live in `src/recipes/builtin.ts`. Add one entry following the
existing shape:

```typescript
{
  name: 'finder-empty-trash',          // kebab-case, unique
  description: 'Empty the Finder trash',
  app: 'Finder',                       // optional, used as appContext
  steps: [
    {
      actionType: 'applescript',
      params: { script: 'tell application "Finder" to empty trash' },
      description: 'Empty trash',
    },
  ],
  tags: ['finder', 'trash', 'cleanup'],
},
```

### Recipe checklist

- [ ] Name follows `<category>-<action>` (kebab-case).
- [ ] Description is one sentence, action-first.
- [ ] Each step passes the security sandbox (no `sudo`, `rm -rf`, `$()`, backticks, `defaults write LoginItems`, etc.).
- [ ] If the recipe takes parameters, use `{{placeholderName}}` and list them in `parameters` when saving via `mac_recipe_save`.
- [ ] Tested on macOS 14+ (note in PR description what you tested).
- [ ] `npm test` passes locally.

### Multi-step recipes

For UI flows that AppleScript can't drive directly (e.g. Mail search), chain
`applescript` + `keypress` + `type`. See `safari-find-in-page` for an example.

## Reporting bugs

Open an issue at https://github.com/leesgit/mac-pilot-mcp/issues with:

- Mac-Pilot version (`mac-pilot-mcp --version` or `package.json`).
- MCP client name + version (Claude Desktop / Cursor / Claude Code / …).
- macOS version (`sw_vers -productVersion`).
- The tool call that failed and the error output (with secrets removed).
- What you expected to happen.

## Code style

- TypeScript strict mode. `any` is rejected; use `unknown` + a type guard.
- One-line comments explain *why*, not *what*. The code already shows what.
- Tests are vitest. Mocks for `child_process` live next to the test file.
- Commits follow conventional commits (`fix(security):`, `feat(electron):`, …).

## Security issues

Do not open a public issue for security bugs. See [SECURITY.md](./SECURITY.md).
