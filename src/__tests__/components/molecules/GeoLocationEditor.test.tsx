import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GeoLocationEditor } from '@/components/molecules/GeoLocationEditor/GeoLocationEditor';
import * as geocodeModule from '@/pages/scheduling/SchedulingTaskDetailPage/lib/geocode';

vi.mock('@/pages/scheduling/SchedulingTaskDetailPage/lib/geocode', () => ({
  geocodeAddress: vi.fn(),
  reverseGeocode: vi.fn(),
}));

// plusCode is the real implementation — no mock
vi.mock('@/lib/plusCode', async (importOriginal) => {
  return importOriginal();
});

const VALUE_WITH_COORDS = {
  lat: -34.6032,
  lng: -58.3816,
  plusCode: '48Q3CJ2C+22',
};

const VALUE_EMPTY = {
  lat: null,
  lng: null,
  plusCode: null,
};

describe('GeoLocationEditor', () => {
  const onSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
  });

  // -- Rendering with coords --

  it('renders the map container when value has lat/lng', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    // The react-leaflet mock renders MapContainer as <div data-testid="map-container">
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders the marker when value has lat/lng', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    expect(screen.getByTestId('map-marker')).toBeInTheDocument();
  });

  it('renders coordinate display when value has lat/lng', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    expect(screen.getByTestId('geo-coords')).toBeInTheDocument();
    expect(screen.getByText(/−34\.603200|34\.6032/)).toBeTruthy();
  });

  // -- Empty state --

  it('renders empty state when value has no coords', () => {
    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} />);
    expect(screen.getByTestId('geo-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Sin ubicación cargada')).toBeInTheDocument();
  });

  it('shows a CTA hint to set location when canEdit=true and empty', () => {
    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} />);
    expect(screen.getByText(/Buscá una dirección/i)).toBeInTheDocument();
  });

  it('does NOT show CTA hint when canEdit=false and empty', () => {
    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={false} />);
    expect(screen.queryByText(/Buscá una dirección/i)).not.toBeInTheDocument();
  });

  // -- Address search input visibility --

  it('shows address search input when canEdit=true', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    expect(screen.getByRole('textbox', { name: /buscar dirección/i })).toBeInTheDocument();
  });

  it('hides address search input when canEdit=false', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={false} />);
    expect(screen.queryByRole('textbox', { name: /buscar dirección/i })).not.toBeInTheDocument();
  });

  // -- plusCode display / link --

  it('shows the plusCode link to Google Maps when coords are present', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    const link = screen.getByTestId('geo-maps-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      `https://www.google.com/maps?q=${VALUE_WITH_COORDS.lat},${VALUE_WITH_COORDS.lng}`,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does NOT show Maps link when coords are null', () => {
    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} />);
    expect(screen.queryByTestId('geo-maps-link')).not.toBeInTheDocument();
  });

  // -- Guardar button visibility based on canEdit --

  it('renders the save button when canEdit=true', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    expect(screen.getByTestId('geo-save-button')).toBeInTheDocument();
  });

  it('does NOT render the save button when canEdit=false', () => {
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={false} />);
    expect(screen.queryByTestId('geo-save-button')).not.toBeInTheDocument();
  });

  // -- Save calls onSave with correct payload --

  it('clicking save calls onSave with current lat, lng, and plusCode', async () => {
    const user = userEvent.setup();
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);

    await user.click(screen.getByTestId('geo-save-button'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        lat: VALUE_WITH_COORDS.lat,
        lng: VALUE_WITH_COORDS.lng,
        plusCode: expect.any(String),
      });
    });
  });

  it('plusCode passed to onSave is auto-computed from lat/lng', async () => {
    const user = userEvent.setup();
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    await user.click(screen.getByTestId('geo-save-button'));

    await waitFor(() => {
      const saved = onSave.mock.calls[0][0];
      // Verify format: XXXXXXXX+XX
      expect(saved.plusCode).toMatch(/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/);
    });
  });

  // -- Title prop --

  it('renders default title "Ubicación GPS"', () => {
    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} />);
    expect(screen.getByRole('heading', { name: 'Ubicación GPS' })).toBeInTheDocument();
  });

  it('renders custom title when provided', () => {
    render(
      <GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} title="Mi Ubicación" />,
    );
    expect(screen.getByRole('heading', { name: 'Mi Ubicación' })).toBeInTheDocument();
  });

  // -- referenceAddress hint --

  it('shows reference address when provided', () => {
    render(
      <GeoLocationEditor
        value={VALUE_EMPTY}
        onSave={onSave}
        canEdit={true}
        referenceAddress="Av. Corrientes 1234, CABA"
      />,
    );
    expect(screen.getByText(/Av\. Corrientes 1234/)).toBeInTheDocument();
  });

  it('does not show reference address when not provided', () => {
    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} />);
    expect(screen.queryByLabelText('Dirección de referencia GR')).not.toBeInTheDocument();
  });

  // -- Address search updates coords and recomputes plusCode --

  it('address search geocodes and updates plusCode input', async () => {
    vi.mocked(geocodeModule.geocodeAddress).mockResolvedValue({ lat: -34.6, lng: -58.38 });
    const user = userEvent.setup({ delay: null });

    render(<GeoLocationEditor value={VALUE_EMPTY} onSave={onSave} canEdit={true} />);

    const searchInput = screen.getByRole('textbox', { name: /buscar dirección/i });
    await user.type(searchInput, 'Buenos Aires');

    // Wait for geocode to be called (debounced)
    await waitFor(() => {
      expect(geocodeModule.geocodeAddress).toHaveBeenCalledWith('Buenos Aires');
    }, { timeout: 3000 });

    // plusCode should update
    await waitFor(() => {
      const plusInput = screen.getByLabelText('Plus Code');
      expect((plusInput as HTMLInputElement).value).toMatch(
        /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2}$/,
      );
    });
  });

  // -- save shows success state then clears --

  it('shows success message after save', async () => {
    const user = userEvent.setup();
    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    await user.click(screen.getByTestId('geo-save-button'));
    await waitFor(() => {
      expect(screen.getByText('Ubicación guardada.')).toBeInTheDocument();
    });
  });

  // -- save shows error when onSave rejects --

  it('shows error message when onSave rejects', async () => {
    onSave.mockRejectedValue(new Error('Servidor no disponible'));
    const user = userEvent.setup();

    render(<GeoLocationEditor value={VALUE_WITH_COORDS} onSave={onSave} canEdit={true} />);
    await user.click(screen.getByTestId('geo-save-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Servidor no disponible')).toBeInTheDocument();
    });
  });
});
