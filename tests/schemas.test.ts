import { describe, it, expect } from 'vitest';
import {
  MacRunSchema,
  MacFindUiSchema,
  MacScreenshotSchema,
  MacStateSchema,
  MacRecipeSaveSchema,
  MacRecipeRunSchema,
  MacRecipeSearchSchema,
} from '../src/schemas.js';

describe('MacRunSchema', () => {
  it('should accept valid applescript action', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'applescript',
      script: 'tell application "Finder" to activate',
    });
    expect(result.success).toBe(true);
  });

  it('should reject applescript without script', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'applescript',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid shell action', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'shell',
      command: 'ls -la',
    });
    expect(result.success).toBe(true);
  });

  it('should reject shell without command', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'shell',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid open action', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'open',
      target: 'Safari',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid click action with coordinates', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'click',
      x: 100,
      y: 200,
    });
    expect(result.success).toBe(true);
  });

  it('should reject click without coordinates', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'click',
      x: 100,
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid type action', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'type',
      text: 'Hello World',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid keypress action', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'keypress',
      text: 'cmd+c',
    });
    expect(result.success).toBe(true);
  });

  it('should accept dryRun option', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'open',
      target: 'Safari',
      dryRun: true,
    });
    expect(result.success).toBe(true);
  });

  it('should accept timeout within range', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'shell',
      command: 'echo hello',
      timeout: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('should reject timeout below minimum', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'shell',
      command: 'echo hello',
      timeout: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should reject timeout above maximum', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'shell',
      command: 'echo hello',
      timeout: 60000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid actionType', () => {
    const result = MacRunSchema.safeParse({
      actionType: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('MacFindUiSchema', () => {
  it('should accept app only', () => {
    const result = MacFindUiSchema.safeParse({ app: 'Finder' });
    expect(result.success).toBe(true);
  });

  it('should accept app with role and title', () => {
    const result = MacFindUiSchema.safeParse({
      app: 'Safari',
      role: 'AXButton',
      title: 'Close',
    });
    expect(result.success).toBe(true);
  });

  it('should accept searchText', () => {
    const result = MacFindUiSchema.safeParse({
      app: 'Finder',
      searchText: 'New Folder',
    });
    expect(result.success).toBe(true);
  });

  it('should reject without app', () => {
    const result = MacFindUiSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should respect maxResults bounds', () => {
    expect(MacFindUiSchema.safeParse({ app: 'Finder', maxResults: 0 }).success).toBe(false);
    expect(MacFindUiSchema.safeParse({ app: 'Finder', maxResults: 51 }).success).toBe(false);
    expect(MacFindUiSchema.safeParse({ app: 'Finder', maxResults: 25 }).success).toBe(true);
  });
});

describe('MacScreenshotSchema', () => {
  it('should accept screen target', () => {
    const result = MacScreenshotSchema.safeParse({ target: 'screen' });
    expect(result.success).toBe(true);
  });

  it('should accept window target with windowName', () => {
    const result = MacScreenshotSchema.safeParse({
      target: 'window',
      windowName: 'Finder',
    });
    expect(result.success).toBe(true);
  });

  it('should reject window target without windowName', () => {
    const result = MacScreenshotSchema.safeParse({ target: 'window' });
    expect(result.success).toBe(false);
  });

  it('should accept region target with region', () => {
    const result = MacScreenshotSchema.safeParse({
      target: 'region',
      region: { x: 0, y: 0, width: 800, height: 600 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject region target without region', () => {
    const result = MacScreenshotSchema.safeParse({ target: 'region' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid scale', () => {
    expect(MacScreenshotSchema.safeParse({ target: 'screen', scale: 0 }).success).toBe(false);
    expect(MacScreenshotSchema.safeParse({ target: 'screen', scale: 2 }).success).toBe(false);
  });
});

describe('MacStateSchema', () => {
  it('should accept empty object', () => {
    const result = MacStateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept valid include fields', () => {
    const result = MacStateSchema.safeParse({
      include: ['frontmost_app', 'clipboard'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid include fields', () => {
    const result = MacStateSchema.safeParse({
      include: ['invalid_field'],
    });
    expect(result.success).toBe(false);
  });
});

describe('MacRecipeSaveSchema', () => {
  it('should accept valid recipe', () => {
    const result = MacRecipeSaveSchema.safeParse({
      name: 'open-safari',
      description: 'Open Safari browser',
      steps: [
        {
          actionType: 'open',
          params: { target: 'Safari' },
          description: 'Open Safari',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept recipe with parameters and tags', () => {
    const result = MacRecipeSaveSchema.safeParse({
      name: 'open-url',
      description: 'Open a URL in default browser',
      app: 'Safari',
      steps: [
        {
          actionType: 'open',
          params: { target: '{{url}}' },
          description: 'Open URL',
        },
      ],
      parameters: [
        { name: 'url', description: 'URL to open', defaultValue: 'https://google.com' },
      ],
      tags: ['browser', 'web'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = MacRecipeSaveSchema.safeParse({
      name: '',
      description: 'test',
      steps: [{ actionType: 'open', params: {}, description: 'test' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty steps', () => {
    const result = MacRecipeSaveSchema.safeParse({
      name: 'test',
      description: 'test',
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject name over 100 chars', () => {
    const result = MacRecipeSaveSchema.safeParse({
      name: 'a'.repeat(101),
      description: 'test',
      steps: [{ actionType: 'open', params: {}, description: 'test' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('MacRecipeRunSchema', () => {
  it('should accept name only', () => {
    const result = MacRecipeRunSchema.safeParse({ name: 'open-safari' });
    expect(result.success).toBe(true);
  });

  it('should accept name with params', () => {
    const result = MacRecipeRunSchema.safeParse({
      name: 'open-url',
      params: { url: 'https://example.com' },
    });
    expect(result.success).toBe(true);
  });

  it('should accept dryRun', () => {
    const result = MacRecipeRunSchema.safeParse({
      name: 'test',
      dryRun: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('MacRecipeSearchSchema', () => {
  it('should accept query only', () => {
    const result = MacRecipeSearchSchema.safeParse({ query: 'open browser' });
    expect(result.success).toBe(true);
  });

  it('should accept query with app filter', () => {
    const result = MacRecipeSearchSchema.safeParse({
      query: 'export',
      app: 'Figma',
    });
    expect(result.success).toBe(true);
  });

  it('should accept includeHistory', () => {
    const result = MacRecipeSearchSchema.safeParse({
      query: 'error fix',
      includeHistory: true,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty query', () => {
    const result = MacRecipeSearchSchema.safeParse({ query: '' });
    expect(result.success).toBe(false);
  });
});
