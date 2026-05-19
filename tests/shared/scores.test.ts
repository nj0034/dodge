import { describe, expect, it } from 'vitest';
import {
  MAX_SURVIVAL_MS,
  normalizeNickname,
  validateScoreSubmission,
} from '../../src/shared/scores';

describe('score validation', () => {
  it('normalizes nickname whitespace and length', () => {
    expect(normalizeNickname('  pilot  ')).toBe('pilot');
    expect(normalizeNickname('abcdefghijklmnopq')).toBe('abcdefghijklmnop');
  });

  it('accepts valid submissions', () => {
    expect(validateScoreSubmission({ nickname: 'pilot', survivalMs: 12_345 })).toEqual({
      ok: true,
      nickname: 'pilot',
      survivalMs: 12_345,
    });
  });

  it('rejects invalid submissions', () => {
    expect(validateScoreSubmission({ nickname: '', survivalMs: 10 }).ok).toBe(false);
    expect(validateScoreSubmission({ nickname: 'pilot', survivalMs: 0 }).ok).toBe(false);
    expect(
      validateScoreSubmission({
        nickname: 'pilot',
        survivalMs: MAX_SURVIVAL_MS + 1,
      }).ok,
    ).toBe(false);
  });
});
