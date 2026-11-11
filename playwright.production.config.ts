import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: '**/schedule-manager.spec.ts',
  grep: /previous balances and teacher exemptions control candidate choices and persist/,
  outputDir: 'test-results/production',
  reporter: 'list',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4174/nabd-al-injaz/' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort --base=/nabd-al-injaz/',
    url: 'http://127.0.0.1:4174/nabd-al-injaz/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
