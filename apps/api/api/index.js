// Vercel serverless function entry point
// The Express app is bundled by tsup into dist/index.js (CommonJS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const entry = require('../dist/index.js');

// Support both named and default exports from the bundle
const app = entry.default ?? entry.app ?? entry;

module.exports = app;
