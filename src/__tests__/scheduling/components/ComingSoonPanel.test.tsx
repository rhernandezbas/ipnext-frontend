import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComingSoonPanel } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ComingSoonPanel';

describe('ComingSoonPanel', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the title prop', () => {
    render(<ComingSoonPanel title="Adjuntos" description="Podrás adjuntar archivos a esta tarea." />);
    expect(screen.getByRole('heading', { name: 'Adjuntos' })).toBeInTheDocument();
  });

  it('renders the description prop', () => {
    render(<ComingSoonPanel title="Adjuntos" description="Podrás adjuntar archivos a esta tarea." />);
    expect(screen.getByText('Podrás adjuntar archivos a esta tarea.')).toBeInTheDocument();
  });

  it('renders a "Próximamente" badge', () => {
    render(<ComingSoonPanel title="Adjuntos" description="Podrás adjuntar archivos a esta tarea." />);
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
  });

  it('fires zero network requests on mount', () => {
    render(<ComingSoonPanel title="Adjuntos" description="Podrás adjuntar archivos a esta tarea." />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
