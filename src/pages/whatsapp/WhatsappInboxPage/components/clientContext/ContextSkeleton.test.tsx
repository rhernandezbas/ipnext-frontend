import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContextSkeleton } from './ContextSkeleton';

describe('ContextSkeleton (messaging-inbox-v2 F1.5, design §4/§8.3 — alto reservado)', () => {
  it('renderiza varios placeholders decorativos (role="presentation", el Skeleton compartido)', () => {
    const { container } = render(<ContextSkeleton />);
    const placeholders = container.querySelectorAll('[role="presentation"]');
    expect(placeholders.length).toBeGreaterThanOrEqual(4);
  });

  it('el wrapper es aria-hidden (decorativo — el "cargando" lo comunica el container, no este)', () => {
    const { container } = render(<ContextSkeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('bug ALTO layout (review adversarial): los 3 bloques reservan un alto cercano al real (~150/~120/~190), no 72/56/96 (layout shift ~2x)', () => {
    const { container } = render(<ContextSkeleton />);
    const placeholders = container.querySelectorAll<HTMLElement>('[role="presentation"]');
    // [0]=avatar circle, [1..2]=identity lines, [3..5]=los 3 bloques (fin/svc/int).
    const [, , , block1, block2, block3] = placeholders;
    expect(parseInt(block1!.style.height, 10)).toBeGreaterThanOrEqual(140);
    expect(parseInt(block2!.style.height, 10)).toBeGreaterThanOrEqual(110);
    expect(parseInt(block3!.style.height, 10)).toBeGreaterThanOrEqual(170);
  });
});
