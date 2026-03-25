// Vercel serverless function entry point
// The Express app is bundled by tsup (CJS) into dist/index.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = require('../dist/index.js');
