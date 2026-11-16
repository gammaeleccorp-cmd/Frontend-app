import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { formatTelemetryTime } from '../src/utils/telemetry.mjs';

test('Routes renders each recorded timestamp beside its own exact Neshan link', async () => {
  // Leaflet requires a browser; stub only the map layer for this markup check.
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    ssr: { noExternal: ['react-leaflet'] },
    plugins: [{
      name: 'map-stub', enforce: 'pre',
      resolveId(id) { if (id === 'react-leaflet') return '\0map-stub'; },
      load(id) {
        if (id === '\0map-stub') return `
          export const MapContainer = ({children}) => children;
          export const TileLayer = () => null;
          export const Polyline = () => null;
          export const CircleMarker = () => null;
          export const Circle = () => null;
          export const Polygon = () => null;
          export const Tooltip = () => null;
          export const useMap = () => ({});
          export const useMapEvents = () => ({});
        `;
      },
    }],
  });
  try {
    const { default: RoutesPage } = await vite.ssrLoadModule('/src/pages/RoutesPage.jsx');
    const older = { id: 1, recordedAt: '2026-11-15T08:00:00Z', coordinates: [35.70857123, 51.37728456], speed: 12 };
    const newer = { id: 2, recordedAt: '2026-11-16T09:30:00Z', coordinates: [36.12345678, 52.87654321], speed: 24 };
    const html = renderToStaticMarkup(createElement(RoutesPage, { routeHistory: [older, { id: 3, recordedAt: '2027-01-01', coordinates: [999, 51] }, newer] }));
    assert.match(html, /<details class="panel route-history"><summary>/);
    assert.doesNotMatch(html, /<details[^>]*\bopen/);
    assert.match(html, /2 مورد/);
    assert.match(html, /route-history-chevron/);
    const rows = [...html.matchAll(/<article class="route-row">(.*?)<\/article>/g)].map(match => match[1]);
    assert.equal(rows.length, 2);
    for (const [index, point] of [newer, older].entries()) {
      assert.ok(rows[index].includes(`<time dateTime="${point.recordedAt}">${formatTelemetryTime(point.recordedAt)}</time>`));
      assert.ok(rows[index].includes(`href="https://neshan.org/maps/@${point.coordinates.join(',')},16z" target="_blank" rel="noopener noreferrer">مشاهده در نشان</a>`));
      assert.ok(rows[index].includes(`${point.speed} km/h`));
    }
    assert.equal((html.match(/neshan.org/g) || []).length, 2);
    assert.doesNotMatch(html, /باز کردن آخرین موقعیت/);
    const empty = renderToStaticMarkup(createElement(RoutesPage, {}));
    assert.match(empty, /هنوز موقعیتی در تاریخچه ثبت نشده است/);
    assert.doesNotMatch(empty, /neshan.org/);
  } finally {
    await vite.close();
  }
});
