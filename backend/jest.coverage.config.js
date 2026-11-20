// Coverage of both suites in one jest run, so code exercised by either one counts.
// testTimeout is a run-wide option, not a per-project one, so it is lifted out of the suite configs.
const project = (displayName, { testTimeout: _testTimeout, ...config }) => ({
  displayName,
  ...config,
});

module.exports = {
  projects: [
    project('unit', require('./jest.config')),
    project('integration', require('./jest.integration.config')),
  ],
  testTimeout: 60000,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  // A path key takes its files out of `global`, so `global` is the rest of the package.
  coverageThreshold: {
    './src/access/': { lines: 90, branches: 90 },
    global: { lines: 80 },
  },
};
