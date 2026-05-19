import { describe, expect, it } from 'vitest';
import { circlesOverlap } from '../../src/game/collision';

describe('circlesOverlap', () => {
  it('returns true when two circles touch or overlap', () => {
    expect(
      circlesOverlap(
        { x: 0, y: 0, radius: 10 },
        { x: 18, y: 0, radius: 8 },
      ),
    ).toBe(true);
  });

  it('returns false when circles are separated', () => {
    expect(
      circlesOverlap(
        { x: 0, y: 0, radius: 10 },
        { x: 30, y: 0, radius: 8 },
      ),
    ).toBe(false);
  });
});
