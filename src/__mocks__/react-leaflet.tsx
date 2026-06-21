import React from 'react';
import { vi } from 'vitest';

export const MapContainer = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-container">{children}</div>
);

export const TileLayer = () => null;

export const Marker = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-marker">{children}</div>
);

export const Popup = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);

export const CircleMarker = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="map-circle">{children}</div>
);

export const Polygon = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="polygon">{children}</div>
);

export const Tooltip = ({ children }: { children?: React.ReactNode }) => (
  <div data-testid="tooltip">{children}</div>
);

export const useMap = vi.fn(() => ({ setView: vi.fn(), fitBounds: vi.fn() }));
