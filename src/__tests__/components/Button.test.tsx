import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { Button } from '@/components/atoms/Button/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders spinner when loading (no text visible)', () => {
    render(<Button loading>Save</Button>);
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Spinner aria role
  });

  it('is disabled when loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards additional HTML button attributes', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('renders an icon-only button that stays accessible via aria-label', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button variant="icon" aria-label="Recargar" onClick={onClick}>
        <svg data-testid="refresh-icon" width="16" height="16" />
      </Button>,
    );
    // Icon-only buttons MUST expose an accessible name (aria-label), since the
    // SVG has no text. The variant must not break that.
    const btn = screen.getByRole('button', { name: 'Recargar' });
    expect(btn).toBeInTheDocument();
    expect(screen.getByTestId('refresh-icon')).toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
