import { describe, expect, it } from 'vitest';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../src/game/config';
import { createGameState } from '../../src/game/state';

describe('world scale', () => {
  it('uses the zoomed-out high-resolution playfield', () => {
    expect(WORLD_WIDTH).toBe(1280);
    expect(WORLD_HEIGHT).toBe(853);
  });

  it('starts the player in the center of the expanded world', () => {
    const state = createGameState(1);

    expect(state.bounds).toEqual({ width: 1280, height: 853 });
    expect(state.player.position).toEqual({ x: 640, y: 426.5 });
  });
});
