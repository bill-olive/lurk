// =============================================================================
// DiffEngine & MergeEngine — Unit tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import { DiffEngine } from '../diff.js';
import { MergeEngine } from '../merge.js';

// ---------------------------------------------------------------------------
// DiffEngine tests
// ---------------------------------------------------------------------------

describe('DiffEngine', () => {
  let engine: DiffEngine;

  beforeEach(() => {
    engine = new DiffEngine();
  });

  describe('computeTextDiff', () => {
    it('should detect no changes for identical strings', () => {
      const diff = engine.computeTextDiff('hello\nworld', 'hello\nworld');
      expect(diff.addedLines).toBe(0);
      expect(diff.removedLines).toBe(0);
      expect(diff.hunks).toHaveLength(0);
    });

    it('should detect a single line addition', () => {
      const original = 'line1\nline2';
      const modified = 'line1\nline2\nline3';
      const diff = engine.computeTextDiff(original, modified);
      expect(diff.addedLines).toBe(1);
      expect(diff.removedLines).toBe(0);
      expect(diff.type).toBe('text');
    });

    it('should detect a single line deletion', () => {
      const original = 'line1\nline2\nline3';
      const modified = 'line1\nline3';
      const diff = engine.computeTextDiff(original, modified);
      expect(diff.removedLines).toBe(1);
    });

    it('should detect a line modification', () => {
      const original = 'line1\noriginal\nline3';
      const modified = 'line1\nmodified\nline3';
      const diff = engine.computeTextDiff(original, modified);
      expect(diff.addedLines).toBe(1);
      expect(diff.removedLines).toBe(1);
    });

    it('should produce hunks with correct content', () => {
      const original = 'line1\nold line\nline3';
      const modified = 'line1\nnew line\nline3';
      const diff = engine.computeTextDiff(original, modified);
      expect(diff.hunks.length).toBeGreaterThan(0);
      const content = diff.hunks[0].content;
      expect(content).toContain('-');
      expect(content).toContain('+');
    });

    it('should handle empty original', () => {
      const diff = engine.computeTextDiff('', 'new line');
      expect(diff.addedLines).toBe(1);
      expect(diff.removedLines).toBe(0);
    });

    it('should handle empty modified', () => {
      const diff = engine.computeTextDiff('old line', '');
      expect(diff.removedLines).toBe(1);
      expect(diff.addedLines).toBe(0);
    });

    it('should handle multi-line diffs correctly', () => {
      const original = 'a\nb\nc\nd\ne';
      const modified = 'a\nB\nc\nD\ne\nf';
      const diff = engine.computeTextDiff(original, modified);
      // b->B, d->D are modifications (1 add + 1 remove each), f is addition
      expect(diff.addedLines).toBeGreaterThanOrEqual(3); // B, D, f
      expect(diff.removedLines).toBeGreaterThanOrEqual(2); // b, d
    });

    it('should produce a meaningful summary', () => {
      const diff = engine.computeTextDiff('old', 'new');
      expect(diff.summary).toContain('added');
    });
  });

  describe('computeStructuredDiff', () => {
    it('should detect no changes for identical objects', () => {
      const obj = { a: 1, b: 'hello' };
      const diff = engine.computeStructuredDiff(obj, { ...obj });
      expect(diff.addedLines).toBe(0);
      expect(diff.removedLines).toBe(0);
    });

    it('should detect added keys', () => {
      const original = { a: 1 };
      const modified = { a: 1, b: 2 };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.addedLines).toBe(1);
      expect(diff.changedSections).toContain('b');
    });

    it('should detect removed keys', () => {
      const original = { a: 1, b: 2 };
      const modified = { a: 1 };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.removedLines).toBe(1);
      expect(diff.changedSections).toContain('b');
    });

    it('should detect modified values', () => {
      const original = { a: 1, b: 'old' };
      const modified = { a: 1, b: 'new' };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.addedLines).toBe(1);
      expect(diff.removedLines).toBe(1);
      expect(diff.changedSections).toContain('b');
    });

    it('should handle nested objects', () => {
      const original = { a: { nested: { deep: 'old' } } };
      const modified = { a: { nested: { deep: 'new' } } };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.changedSections).toContain('a.nested.deep');
    });

    it('should handle arrays', () => {
      const original = { items: [1, 2, 3] };
      const modified = { items: [1, 2, 3, 4] };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.addedLines).toBe(1);
    });

    it('should detect type changes', () => {
      const original = { a: 'string' };
      const modified = { a: 42 };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.addedLines).toBe(1);
      expect(diff.removedLines).toBe(1);
    });

    it('should handle null values', () => {
      const original = { a: null };
      const modified = { a: 'not null' };
      const diff = engine.computeStructuredDiff(original, modified);
      expect(diff.addedLines).toBe(1);
    });

    it('should produce structured diff type', () => {
      const diff = engine.computeStructuredDiff({ a: 1 }, { a: 2 });
      expect(diff.type).toBe('structured');
    });
  });

  describe('computeDiffStats', () => {
    it('should return correct stats for a text diff', () => {
      const diff = engine.computeTextDiff('a\nb\nc', 'a\nB\nc\nd');
      const stats = engine.computeDiffStats(diff);
      expect(stats.addedLines).toBe(diff.addedLines);
      expect(stats.removedLines).toBe(diff.removedLines);
      expect(stats.changedSections).toBe(diff.changedSections.length);
    });

    it('should return zero stats for identical content', () => {
      const diff = engine.computeTextDiff('same', 'same');
      const stats = engine.computeDiffStats(diff);
      expect(stats.addedLines).toBe(0);
      expect(stats.removedLines).toBe(0);
      expect(stats.changedSections).toBe(0);
    });
  });

  describe('generateDiffSummary', () => {
    it('should generate "No changes" for empty diff', () => {
      const diff = engine.computeTextDiff('same', 'same');
      const summary = engine.generateDiffSummary(diff);
      expect(summary).toBe('No changes detected.');
    });

    it('should include line counts in summary', () => {
      const diff = engine.computeTextDiff('a', 'b');
      const summary = engine.generateDiffSummary(diff);
      expect(summary).toContain('added');
    });
  });
});

// ---------------------------------------------------------------------------
// MergeEngine tests
// ---------------------------------------------------------------------------

describe('MergeEngine', () => {
  let engine: MergeEngine;

  beforeEach(() => {
    engine = new MergeEngine();
  });

  describe('fast_forward strategy', () => {
    it('should fast-forward when ours has not changed from base', async () => {
      const base = 'line1\nline2';
      const ours = 'line1\nline2';
      const theirs = 'line1\nline2\nline3';
      const result = await engine.merge(base, ours, theirs, 'fast_forward');
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('fast_forward');
      expect(result.merged).toBe(theirs);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should fast-forward when base is null', async () => {
      const result = await engine.merge(null, 'ours', 'theirs', 'fast_forward');
      expect(result.success).toBe(true);
      expect(result.merged).toBe('theirs');
    });

    it('should succeed when ours === theirs', async () => {
      const result = await engine.merge('base', 'same', 'same', 'fast_forward');
      expect(result.success).toBe(true);
      expect(result.merged).toBe('same');
    });

    it('should fail when both sides have diverged', async () => {
      const result = await engine.merge('base', 'ours changed', 'theirs changed', 'fast_forward');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot fast-forward');
    });
  });

  describe('theirs strategy', () => {
    it('should always take theirs content', async () => {
      const result = await engine.merge('base', 'ours', 'theirs', 'theirs');
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('theirs');
      expect(result.merged).toBe('theirs');
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('ours strategy', () => {
    it('should always keep ours content', async () => {
      const result = await engine.merge('base', 'ours', 'theirs', 'ours');
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('ours');
      expect(result.merged).toBe('ours');
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('three_way strategy', () => {
    it('should merge cleanly when changes do not overlap', async () => {
      const base = 'line1\nline2\nline3';
      const ours = 'LINE1\nline2\nline3';   // changed line 1
      const theirs = 'line1\nline2\nLINE3';  // changed line 3
      const result = await engine.merge(base, ours, theirs, 'three_way');
      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.merged).toContain('LINE1');
      expect(result.merged).toContain('LINE3');
    });

    it('should detect conflicts when both modify the same line', async () => {
      const base = 'line1\noriginal\nline3';
      const ours = 'line1\nours version\nline3';
      const theirs = 'line1\ntheirs version\nline3';
      const result = await engine.merge(base, ours, theirs, 'three_way');
      expect(result.success).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].ours).toContain('ours');
      expect(result.conflicts[0].theirs).toContain('theirs');
      expect(result.requiresExternalResolution).toBe(true);
    });

    it('should include conflict markers in merged output', async () => {
      const base = 'same\nconflict\nsame';
      const ours = 'same\nours\nsame';
      const theirs = 'same\ntheirs\nsame';
      const result = await engine.merge(base, ours, theirs, 'three_way');
      expect(result.merged).toContain('<<<<<<< ours');
      expect(result.merged).toContain('=======');
      expect(result.merged).toContain('>>>>>>> theirs');
    });

    it('should succeed when both sides make the same change', async () => {
      const base = 'old\nline2';
      const ours = 'new\nline2';
      const theirs = 'new\nline2';
      const result = await engine.merge(base, ours, theirs, 'three_way');
      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('selectStrategy', () => {
    it('should select fast_forward when base is null', () => {
      expect(engine.selectStrategy(null, 'ours', 'theirs')).toBe('fast_forward');
    });

    it('should select fast_forward when ours === base', () => {
      expect(engine.selectStrategy('base', 'base', 'theirs')).toBe('fast_forward');
    });

    it('should select ours when theirs === base', () => {
      expect(engine.selectStrategy('base', 'ours', 'base')).toBe('ours');
    });

    it('should select three_way when both have changed', () => {
      expect(engine.selectStrategy('base', 'ours', 'theirs')).toBe('three_way');
    });
  });

  describe('semantic_merge strategy', () => {
    it('should fail without registered callback when there are conflicts', async () => {
      const base = 'conflict\nline';
      const ours = 'ours\nline';
      const theirs = 'theirs\nline';
      const result = await engine.merge(base, ours, theirs, 'semantic_merge');
      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM callback');
    });

    it('should use callback to resolve conflicts', async () => {
      engine.registerSemanticMerge(async (_base, _ours, _theirs, _conflicts) => {
        return 'resolved by LLM';
      });
      const base = 'conflict\nline';
      const ours = 'ours\nline';
      const theirs = 'theirs\nline';
      const result = await engine.merge(base, ours, theirs, 'semantic_merge');
      expect(result.success).toBe(true);
      expect(result.merged).toBe('resolved by LLM');
    });

    it('should succeed without callback when no conflicts exist', async () => {
      const base = 'line1\nline2';
      const ours = 'LINE1\nline2';
      const theirs = 'line1\nLINE2';
      const result = await engine.merge(base, ours, theirs, 'semantic_merge');
      expect(result.success).toBe(true);
    });
  });

  describe('manual strategy', () => {
    it('should always return success=false and flag for manual resolution', async () => {
      const base = 'conflict';
      const ours = 'ours';
      const theirs = 'theirs';
      const result = await engine.merge(base, ours, theirs, 'manual');
      expect(result.success).toBe(false);
      expect(result.strategy).toBe('manual');
      expect(result.requiresExternalResolution).toBe(true);
    });
  });

  describe('unknown strategy', () => {
    it('should return an error for unknown strategies', async () => {
      const result = await engine.merge('', 'a', 'b', 'unknown_strategy' as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown merge strategy');
    });
  });
});
