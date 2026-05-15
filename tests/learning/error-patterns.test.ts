import { describe, it, expect } from 'vitest';
import { classifyError, knowledgeKey, renderHint } from '../../src/learning/error-patterns.js';

describe('classifyError', () => {
  it('should classify Automation permission denial', () => {
    const cls = classifyError('execution error: Not authorized to send Apple events to System Events. (-1743)');
    expect(cls.errorClass).toBe('permission');
    expect(cls.retryStrategy).toBe('request_permission');
    expect(cls.suggestion).toMatch(/Automation/i);
  });

  it('should classify Accessibility permission denial', () => {
    const cls = classifyError('System Events got an error: osascript is not allowed assistive access.');
    expect(cls.errorClass).toBe('permission');
    expect(cls.suggestion).toMatch(/Accessibility/i);
  });

  it('should classify app-not-running error', () => {
    const cls = classifyError('Application isn\'t running.');
    expect(cls.errorClass).toBe('app_not_running');
    expect(cls.retryStrategy).toBe('launch_app_first');
  });

  it('should classify missing UI object', () => {
    const cls = classifyError('System Events got an error: object is not accessible');
    expect(cls.errorClass).toBe('object_missing');
    expect(cls.retryStrategy).toBe('use_ax_query');
  });

  it('should classify menu-item not found as object_missing', () => {
    const cls = classifyError('Can\'t get menu item "Export" of menu "File" of menu bar 1');
    expect(cls.errorClass).toBe('object_missing');
  });

  it('should classify syntax error and suggest jxa', () => {
    const cls = classifyError('execution error: syntax error: A unknown token can\'t go here.');
    expect(cls.errorClass).toBe('invalid_syntax');
    expect(cls.retryStrategy).toBe('use_jxa');
  });

  it('should classify timeout', () => {
    const cls = classifyError('Timeout after 5000ms');
    expect(cls.errorClass).toBe('timeout');
  });

  it('should fall back to unknown', () => {
    const cls = classifyError('what is this anyway');
    expect(cls.errorClass).toBe('unknown');
    expect(cls.suggestion).toMatch(/Unclassified/);
  });

  it('should truncate very long raw errors', () => {
    const long = 'a'.repeat(300);
    const cls = classifyError(long);
    expect(cls.rawExcerpt.length).toBeLessThanOrEqual(201);
  });
});

describe('knowledgeKey', () => {
  it('should produce stable key for the same class', () => {
    const cls1 = classifyError('Application isn\'t running.');
    const cls2 = classifyError('Application isn\'t running. (different timestamp)');
    expect(knowledgeKey('Safari', 'applescript', cls1)).toBe(knowledgeKey('Safari', 'applescript', cls2));
  });

  it('should differ across error classes', () => {
    const a = classifyError('Application isn\'t running.');
    const b = classifyError('Timeout after 1000ms');
    expect(knowledgeKey('Safari', 'applescript', a)).not.toBe(knowledgeKey('Safari', 'applescript', b));
  });

  it('should differ across apps', () => {
    const cls = classifyError('Timeout after 1000ms');
    expect(knowledgeKey('Safari', 'applescript', cls)).not.toBe(knowledgeKey('Mail', 'applescript', cls));
  });
});

describe('renderHint', () => {
  it('should include error class and retry strategy', () => {
    const cls = classifyError('Application isn\'t running.');
    const hint = renderHint(cls);
    expect(hint).toMatch(/\[app_not_running\]/);
    expect(hint).toMatch(/\[retry: launch_app_first\]/);
  });

  it('should omit retry tag when none', () => {
    const cls = classifyError('what is this anyway');
    const hint = renderHint(cls);
    expect(hint).not.toMatch(/\[retry:/);
  });
});
