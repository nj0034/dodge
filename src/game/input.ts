import type { InputState } from './types';

const ARROW_TO_DIRECTION: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const createEmptyInput = (): InputState => ({
  left: false,
  right: false,
  up: false,
  down: false,
});

export type KeyboardInput = {
  current: InputState;
  reset: () => void;
  dispose: () => void;
};

export type KeyboardInputOptions = {
  onDirectionPressed?: (input: InputState) => void;
};

export function createKeyboardInput(
  target: Window = window,
  options: KeyboardInputOptions = {},
): KeyboardInput {
  const current = createEmptyInput();

  const handleKey = (event: KeyboardEvent, pressed: boolean) => {
    const direction = ARROW_TO_DIRECTION[event.key];

    if (!direction) {
      return;
    }

    event.preventDefault();
    current[direction] = pressed;

    if (pressed && !event.repeat) {
      options.onDirectionPressed?.(current);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => handleKey(event, true);
  const handleKeyUp = (event: KeyboardEvent) => handleKey(event, false);
  const reset = () => {
    current.left = false;
    current.right = false;
    current.up = false;
    current.down = false;
  };

  target.addEventListener('keydown', handleKeyDown, { passive: false });
  target.addEventListener('keyup', handleKeyUp, { passive: false });
  target.addEventListener('blur', reset);

  return {
    current,
    reset,
    dispose: () => {
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
      target.removeEventListener('blur', reset);
    },
  };
}
