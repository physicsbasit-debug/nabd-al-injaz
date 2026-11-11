import { expect, test } from 'vitest';
import config from '../playwright.production.config';

test('production checks use only the built Pages preview server', () => {
  const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
  expect(servers).toHaveLength(1);
  expect(servers[0]?.command).toContain('npm run preview');
  expect(servers[0]?.command).toContain('--base=/nabd-al-injaz/');
  expect(servers[0]?.url).toBe('http://127.0.0.1:4174/nabd-al-injaz/');
  expect(config.use?.baseURL).toBe('http://127.0.0.1:4174/nabd-al-injaz/');
});

test('production checks do not overwrite the full browser report', () => {
  expect(config.reporter).toBe('list');
});
