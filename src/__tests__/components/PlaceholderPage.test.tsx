import { render, screen } from '@testing-library/react';
import { PlaceholderPage } from '@/components/templates/PlaceholderPage/PlaceholderPage';

describe('PlaceholderPage', () => {
  it('renders the title', () => {
    render(<PlaceholderPage title="Test Page" />);
    expect(screen.getByRole('heading', { name: 'Test Page' })).toBeInTheDocument();
  });

  it('renders custom description', () => {
    render(<PlaceholderPage title="X" description="Custom desc" />);
    expect(screen.getByText('Custom desc')).toBeInTheDocument();
  });

  it('shows default text when no description', () => {
    render(<PlaceholderPage title="X" />);
    expect(screen.getByText('Sección en desarrollo.')).toBeInTheDocument();
  });
});
