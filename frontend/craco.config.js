const path = require('path');

module.exports = {
  // Linting is done by the shared root ESLint config (`npm run lint`), not by the CRA build.
  eslint: {
    enable: false,
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
