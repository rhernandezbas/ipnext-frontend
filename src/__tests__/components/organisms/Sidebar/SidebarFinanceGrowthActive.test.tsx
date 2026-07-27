import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

/**
 * finance-growth-dashboard (Fase 5, fix wave) — regresión del bloqueante 🔴6.
 *
 * `isItemActive` usa `pathname.startsWith(matchPath)`. "Finanzas" (el
 * cementerio Splynx, `matchPaths: ['/admin/finance']`) está declarado ANTES
 * que "Crecimiento Financiero" (`matchPaths: ['/admin/finance-growth']`) en
 * `CRM_ITEMS`, y `deriveActive` devuelve el PRIMER match. Sin la barra final,
 * `'/admin/finance-growth'.startsWith('/admin/finance')` es `true`, así que
 * entrar a CUALQUIERA de las 7 páginas nuevas de Crecimiento Financiero abría
 * y resaltaba "Finanzas" en vez de su propio acordeón. El fix es un solo
 * carácter (`'/admin/finance/'`, con barra) — este test es el que faltaba
 * ("Ningún test cubre el Sidebar: agregá uno.", brief del bloqueante).
 */

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar — Crecimiento Financiero vs Finanzas (colisión de prefijo, regresión 🔴6)', () => {
  it('/admin/finance-growth expande "Crecimiento Financiero", NUNCA "Finanzas"', () => {
    renderAt('/admin/finance-growth');
    expect(screen.getByRole('button', { name: /crecimiento financiero/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^finanzas$/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: /^resumen$/i })).toBeInTheDocument();
  });

  it('una ruta anidada (/admin/finance-growth/cac) también expande "Crecimiento Financiero"', () => {
    renderAt('/admin/finance-growth/cac');
    expect(screen.getByRole('button', { name: /crecimiento financiero/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^finanzas$/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('/admin/finance/dashboard sigue expandiendo "Finanzas" (el grupo original no se rompe)', () => {
    renderAt('/admin/finance/dashboard');
    expect(screen.getByRole('button', { name: /^finanzas$/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /crecimiento financiero/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
