import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary/RouteErrorBoundary';

// A child that throws on render, to drive the boundary.
function Boom({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Silence the expected React error log noise for thrown children.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <RouteErrorBoundary reload={vi.fn()}>
        <p>contenido normal</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('contenido normal')).toBeInTheDocument();
  });

  it('auto-reloads once on a dynamic-import (chunk) error', () => {
    const reload = vi.fn();
    render(
      <RouteErrorBoundary reload={reload}>
        <Boom message="Failed to fetch dynamically imported module: /assets/Page-abc123.js" />
      </RouteErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does NOT reload twice in a row (anti-loop guard)', () => {
    const reload = vi.fn();
    // Simulate that a reload already happened just now.
    sessionStorage.setItem('route-chunk-reload-ts', String(Date.now()));
    render(
      <RouteErrorBoundary reload={reload}>
        <Boom message="error loading dynamically imported module" />
      </RouteErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    // Instead it shows the recoverable fallback.
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });

  it('shows a fallback (no reload) for a non-chunk runtime error', () => {
    const reload = vi.fn();
    render(
      <RouteErrorBoundary reload={reload}>
        <Boom message="Cannot read properties of undefined (reading 'x')" />
      </RouteErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument();
  });
});
