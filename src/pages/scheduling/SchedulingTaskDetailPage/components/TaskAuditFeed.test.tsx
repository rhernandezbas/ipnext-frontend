import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskAuditFeed } from './TaskAuditFeed';
import { useTaskAuditFindings } from '@/hooks/useTaskAuditFindings';

vi.mock('@/hooks/useTaskAuditFindings', () => ({ useTaskAuditFindings: vi.fn() }));
const mockHook = useTaskAuditFindings as unknown as ReturnType<typeof vi.fn>;

describe('TaskAuditFeed', () => {
  beforeEach(() => mockHook.mockReset());

  it('estado de carga', () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true });
    render(<TaskAuditFeed taskId="t1" />);
    expect(screen.getByText(/Cargando auditoría/)).toBeInTheDocument();
  });

  it('estado vacío (sin auditoría)', () => {
    mockHook.mockReturnValue({ data: [], isLoading: false });
    render(<TaskAuditFeed taskId="t1" />);
    expect(screen.getByText(/Sin auditoría/)).toBeInTheDocument();
  });

  it('muestra un hallazgo con badge de severidad, chip de categoría y autor IA', () => {
    mockHook.mockReturnValue({
      data: [{ id: 'f1', severity: 'critical', category: 'señal', text: 'señal fuera de rango', photoUrls: [], createdAt: '2026-06-01T00:00:00Z' }],
      isLoading: false,
    });
    render(<TaskAuditFeed taskId="t1" />);
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText('señal')).toBeInTheDocument();
    expect(screen.getByText('señal fuera de rango')).toBeInTheDocument();
    expect(screen.getByText('Auditoría IA')).toBeInTheDocument();
  });

  it('un hallazgo ok se muestra como "OK"', () => {
    mockHook.mockReturnValue({
      data: [{ id: 'f1', severity: 'ok', category: 'otros', text: 'Instalación sin observaciones.', photoUrls: [], createdAt: '2026-06-01T00:00:00Z' }],
      isLoading: false,
    });
    render(<TaskAuditFeed taskId="t1" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
