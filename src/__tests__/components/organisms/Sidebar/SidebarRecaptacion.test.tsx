import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: () => ({
    can: () => true,
    isLoading: false,
    isError: false,
    user: null,
    roles: [],
    permissions: ['*'],
  }),
}));

import { Sidebar } from '@/components/organisms/Sidebar/Sidebar';

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/admin/customers/recaptacion']}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar — Clientes group order', () => {
  it('renders Recaptación before Configuración in the Clientes group', () => {
    renderSidebar();

    const links = screen
      .getAllByRole('link')
      .map((el) => el.textContent?.trim() ?? '');

    const recaptacionIdx = links.indexOf('Recaptación');
    const configuracionIdx = links.indexOf('Configuración');

    expect(recaptacionIdx).toBeGreaterThan(-1);
    expect(configuracionIdx).toBeGreaterThan(-1);
    expect(recaptacionIdx).toBeLessThan(configuracionIdx);
  });
});
