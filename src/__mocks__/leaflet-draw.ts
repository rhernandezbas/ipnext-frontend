// Mock for leaflet-draw in tests.
// leaflet-draw is a side-effect import that augments L.Control and L.Draw.Event.
// In tests, leaflet itself is mocked (src/__mocks__/leaflet.ts), so leaflet-draw
// must also be stubbed to avoid the "L is not defined" UMD bootstrap error.
// The ZoneDrawControl component only runs inside a useEffect, which never executes
// in jsdom tests (no real map), so no augmentation is needed here.
export default {};
