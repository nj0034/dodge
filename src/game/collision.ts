import type { Circle } from './types';

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;

  return dx * dx + dy * dy <= radius * radius;
}
