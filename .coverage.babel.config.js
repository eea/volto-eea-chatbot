// Coverage-enabled variant of the Volto babel config. `make start-ci` copies
// this file over core/packages/volto/babel.config.js so that
// babel-plugin-istanbul instruments the app and Cypress can collect
// end-to-end coverage.
//
// Instrumenting the whole workspace breaks the client build (webpack 5 pulls
// server-only code in once tree-shaking is disabled), so only the add-on
// sources are instrumented: they are the only ones SonarQube analyses.
// `cwd` must be the workspace root (/app), otherwise test-exclude would
// ignore the add-on files, which live outside the Volto core package.
const path = require('path');

const defaultBabel = require('./babel');

const workspaceRoot = path.resolve(__dirname, '../../..');

module.exports = function (api) {
  const voltoBabel = defaultBabel(api);
  voltoBabel.plugins.push([
    'istanbul',
    {
      cwd: workspaceRoot,
      include: ['packages/*/src/**'],
      // Mirror the vitest coverage excludes. Without this the integration lcov
      // brings those files back as freshly uncovered entries (measured on PR #45:
      // markdown/index.jsx 56 lines at 0%, utils/index.tsx 49 lines at 5%,
      // schema.jsx 9 lines) and drags the SonarQube ratio down to 79.3.
      exclude: [
        'packages/*/src/**/types/**',
        'packages/*/src/**/index.{js,jsx,ts,tsx}',
        'packages/*/src/**/*config.{js,jsx,ts,tsx}',
        'packages/*/src/**/*schema.{js,jsx,ts,tsx}',
        'packages/*/src/**/*.d.ts',
        'packages/*/src/**/__mocks__/**',
        'packages/*/src/**/{tests,__tests__}/**',
      ],
    },
  ]);
  return voltoBabel;
};
