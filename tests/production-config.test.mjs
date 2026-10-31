import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductionConfig } from '../scripts/production-config.mjs';
test('production accepts only the real Gamma API and disabled mocks', () => {
  validateProductionConfig({});
  validateProductionConfig({ VITE_USE_MOCK_API: 'false', VITE_API_BASE_URL: 'https://api.gamma-tech.ir/' });
  for (const value of ['true', 'TRUE', '1', ' true ']) assert.throws(() => validateProductionConfig({ VITE_USE_MOCK_API: value }));
  for (const value of ['http://localhost:8000', 'http://127.0.0.1', 'http://[::1]', 'https://api.gamma-tech.ir.evil.test', 'https://user:pass@api.gamma-tech.ir', 'https://api.gamma-tech.ir/?x=1']) {
    assert.throws(() => validateProductionConfig({ VITE_API_BASE_URL: value }));
  }
});
