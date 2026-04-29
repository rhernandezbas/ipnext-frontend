import { vi } from 'vitest';

export const map = vi.fn();
export const tileLayer = vi.fn(() => ({ addTo: vi.fn() }));
export const marker = vi.fn(() => ({ addTo: vi.fn(), bindPopup: vi.fn() }));
export const icon = vi.fn();
export const latLng = vi.fn();
export const divIcon = vi.fn();
export const Icon = {
  Default: {
    mergeOptions: vi.fn(),
    prototype: {},
  },
};

export default {
  map,
  tileLayer,
  marker,
  icon,
  latLng,
  divIcon,
  Icon,
};
