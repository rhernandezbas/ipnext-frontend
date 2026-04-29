import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MassSendPage from '@/pages/support/MassSendPage';

describe('MassSendPage', () => {
  it('renders heading "Envío masivo"', () => {
    render(<MemoryRouter><MassSendPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Envío masivo/i })).toBeInTheDocument();
  });

  it('has Canal and Destinatarios selects', () => {
    render(<MemoryRouter><MassSendPage /></MemoryRouter>);
    expect(screen.getByText('Canal')).toBeInTheDocument();
    expect(screen.getByText('Destinatarios')).toBeInTheDocument();
  });

  it('has Asunto and Mensaje fields', () => {
    render(<MemoryRouter><MassSendPage /></MemoryRouter>);
    expect(screen.getByText('Asunto')).toBeInTheDocument();
    expect(screen.getByText('Mensaje')).toBeInTheDocument();
  });

  it('has Enviar button', () => {
    render(<MemoryRouter><MassSendPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Enviar/i })).toBeInTheDocument();
  });
});
