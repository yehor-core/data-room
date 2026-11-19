import { defineConfig, devices } from '@playwright/test';
import { BACKEND_URL, FRONTEND_URL, loadLocalSupabase } from './e2e/support/stack';

// The full stack: local Supabase (started by `npm run test:e2e`), the backend with its production adapters, and the
// production build of the frontend.
const supabase = loadLocalSupabase();

// Listing tests or loading this config (knip does) needs no stack; starting the servers without one fails with this.
const supabaseNotRunning = `node -e "console.error('Local Supabase is not running. Run the e2e tests with npm run test:e2e.'); process.exit(1)"`;

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      name: 'backend',
      cwd: '../backend',
      command: supabase ? 'npm run build && npm run db:migrate && npm start' : supabaseNotRunning,
      url: `${BACKEND_URL}/api/health`,
      env: supabase
        ? {
            NODE_ENV: 'test',
            PORT: new URL(BACKEND_URL).port,
            DATABASE_URL: supabase.dbUrl,
            DIRECT_URL: supabase.dbUrl,
            SUPABASE_URL: supabase.apiUrl,
            SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
            ALLOWED_ORIGINS: FRONTEND_URL,
          }
        : {},
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      name: 'frontend',
      command: supabase
        ? `npm run build && npm run e2e:serve -- --listen ${new URL(FRONTEND_URL).port}`
        : supabaseNotRunning,
      url: FRONTEND_URL,
      env: supabase
        ? {
            BUILD_PATH: 'e2e/build',
            REACT_APP_API_URL: `${BACKEND_URL}/api`,
            REACT_APP_SUPABASE_URL: supabase.apiUrl,
            REACT_APP_SUPABASE_ANON_KEY: supabase.anonKey,
            REACT_APP_SITE_URL: FRONTEND_URL,
          }
        : {},
      reuseExistingServer: !CI,
      timeout: 300_000,
    },
  ],
});
