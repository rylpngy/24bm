import { afterEach, expect, it } from 'vitest';
import { axiosInstance, configureApiClient } from './http-client';

const original = axiosInstance.defaults.baseURL;
afterEach(() => { axiosInstance.defaults.baseURL = original; });
it('accepts an empty base URL for same-origin API access', () => {
  configureApiClient({ baseUrl: '' });
  expect(axiosInstance.defaults.baseURL).toBe('');
  expect(axiosInstance.getUri({ url: '/api/v1/auth/permissions' })).toBe('/api/v1/auth/permissions');
});
it('keeps the configured URL when no override is supplied', () => {
  configureApiClient({ baseUrl: 'https://example.test' });
  configureApiClient({});
  expect(axiosInstance.defaults.baseURL).toBe('https://example.test');
});
