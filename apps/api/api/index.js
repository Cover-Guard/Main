// Vercel serverless function entry point

// Supabase Vercel Integration prefixes env var names with the project label
// (e.g. COVERGUARD_2_POSTGRES_URL). Normalize to standard names before the
// Express app loads so Prisma, Supabase, and other services resolve them.
const _label = process.env.SUPABASE_ENV_LABEL || 'COVERGUARD_2';
[
  'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLED',
  'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
].forEach((name) => {
  if (process.env[name]) return;
  // Prefix convention (Vercel marketplace standard): LABEL_VARNAME
  const prefixed = `${_label}_${name}`;
  if (process.env[prefixed]) { process.env[name] = process.env[prefixed]; return; }
  // Suffix convention (fallback): VARNAME_LABEL
  const suffixed = `${name}_${_label}`;
  if (process.env[suffixed]) { process.env[name] = process.env[suffixed]; }
});

// The Express app is bundled by tsup into dist/index.js (CommonJS)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const entry = require('../dist/index.js');

// Support both named and default exports from the bundle
const app = entry.default ?? entry.app ?? entry;

// Wrap the Express app to guarantee CORS headers on every response,
// including OPTIONS preflight.  Vercel sometimes does not run Express
// middleware on preflight requests, which causes the browser to block
// the subsequent POST/PUT/DELETE.
const ALLOWED_ORIGINS = [
  'https://coverguard.io',
  'https://www.coverguard.io',
  'https://api.coverguard.io',
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // *.coverguard.io subdomains (Vercel previews, etc.)
  if (/^https:\/\/[\w-]+\.coverguard\.io$/.test(origin)) return true;
  // Vercel preview URLs
  if (/^https:\/\/[\w-]+-cover-guard\.vercel\.app$/.test(origin)) return true;
  // Local dev
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  return false;
}

module.exports = (req, res) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Respond to preflight immediately — don't forward to Express
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  return app(req, res);
};
