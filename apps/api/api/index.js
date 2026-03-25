// Vercel serverless function entry point
// The Express app is bundled by tsup (CJS) into dist/index.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const entry = require('../dist/index.js');
module.exports = entry.default || entry.app || entry;
