import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { Tabs } from '@/components/molecules/Tabs/Tabs';

const tabs = [
  { id: 'info', label: 'Información', content: <div>Info content</div> },
  { id: 'services', label: 'Servicios', content: <div>Services content</div> },
  { id: 'billing', label: 'Facturación', content: <div>Billing content</div> },
];

describe('Tabs', () => {
  it('renders all tab buttons', () => {
    render(<Tabs tabs={tabs} activeTab="info" onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Información' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Servicios' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Facturación' })).toBeInTheDocument();
  });

  it('marks active tab with aria-selected=true', () => {
    render(<Tabs tabs={tabs} activeTab="services" onTabChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Servicios' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Información' })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows active tab panel', () => {
    render(<Tabs tabs={tabs} activeTab="info" onTabChange={vi.fn()} />);
    const infoPanel = screen.getByRole('tabpanel', { name: 'Información' });
    expect(infoPanel).toBeVisible();
  });

  it('hides non-active tab panels via display:none', () => {
    render(<Tabs tabs={tabs} activeTab="info" onTabChange={vi.fn()} />);
    // jsdom doesn't resolve aria-labelledby for hidden panels, query by id instead
    const servicesPanel = document.getElementById('panel-services');
    expect(servicesPanel).toHaveStyle({ display: 'none' });
  });

  it('calls onTabChange with correct id when tab clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeTab="info" onTabChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Servicios' }));
    expect(onChange).toHaveBeenCalledWith('services');
  });
});

describe('Tabs mountMode lazy', () => {
  it('non-active tab panel wrapper is in the DOM but its content is not', () => {
    render(
      <Tabs
        tabs={tabs}
        activeTab="info"
        onTabChange={vi.fn()}
        mountMode="lazy"
        mountedIds={new Set(['info'])}
      />,
    );
    // Panel wrapper always present for ARIA
    expect(document.getElementById('panel-services')).toBeInTheDocument();
    // But content must NOT be rendered yet
    expect(screen.queryByText('Services content')).not.toBeInTheDocument();
  });

  it('active tab content renders immediately', () => {
    render(
      <Tabs
        tabs={tabs}
        activeTab="info"
        onTabChange={vi.fn()}
        mountMode="lazy"
        mountedIds={new Set(['info'])}
      />,
    );
    expect(screen.getByText('Info content')).toBeInTheDocument();
  });

  it('content appears after switching to a tab (mountedIds updated)', () => {
    const { rerender } = render(
      <Tabs
        tabs={tabs}
        activeTab="info"
        onTabChange={vi.fn()}
        mountMode="lazy"
        mountedIds={new Set(['info'])}
      />,
    );
    // Switch to services: update activeTab and add 'services' to mountedIds
    rerender(
      <Tabs
        tabs={tabs}
        activeTab="services"
        onTabChange={vi.fn()}
        mountMode="lazy"
        mountedIds={new Set(['info', 'services'])}
      />,
    );
    expect(screen.getByText('Services content')).toBeInTheDocument();
  });

  it('previously-activated content remains in the DOM after switching away (keep-alive)', () => {
    const { rerender } = render(
      <Tabs
        tabs={tabs}
        activeTab="services"
        onTabChange={vi.fn()}
        mountMode="lazy"
        mountedIds={new Set(['info', 'services'])}
      />,
    );
    // Switch back to info — mountedIds still contains 'services'
    rerender(
      <Tabs
        tabs={tabs}
        activeTab="info"
        onTabChange={vi.fn()}
        mountMode="lazy"
        mountedIds={new Set(['info', 'services'])}
      />,
    );
    expect(screen.getByText('Services content')).toBeInTheDocument();
  });

  it('backward compat: mountMode omitted renders all panel contents', () => {
    render(<Tabs tabs={tabs} activeTab="info" onTabChange={vi.fn()} />);
    expect(screen.getByText('Info content')).toBeInTheDocument();
    expect(screen.getByText('Services content')).toBeInTheDocument();
    expect(screen.getByText('Billing content')).toBeInTheDocument();
  });
});
