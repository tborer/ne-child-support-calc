#!/usr/bin/env node
// Local development server: serves the site files and the /api functions
// the same way Vercel does, without needing the Vercel CLI.
//
//   npm run dev                         # fake Stripe (no keys needed)
//   STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_ID=price_... npm run dev
//                                       # real Stripe test mode
//
// PORT defaults to 3000. With no STRIPE_SECRET_KEY, an in-memory fake Stripe
// with its own "checkout" page is used (this is what the Playwright tests use).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createCheckoutHandler, createCalculateHandler, stripeFromEnv } = require('../lib/payments');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const ORIGIN = `http://localhost:${PORT}`;

const env = { ...process.env, SITE_URL: process.env.SITE_URL || ORIGIN };
let getStripe;
let fake = null;
if (env.STRIPE_SECRET_KEY) {
  getStripe = stripeFromEnv();
  console.log('Using real Stripe (test keys recommended).');
} else {
  const { createFakeStripe } = require('../tests/support/fake-stripe');
  fake = createFakeStripe(ORIGIN);
  getStripe = () => fake.stripe;
  env.STRIPE_SECRET_KEY = 'sk_test_fake';
  env.STRIPE_PRICE_ID = env.STRIPE_PRICE_ID || 'price_fake';
  console.log('Using fake Stripe (no STRIPE_SECRET_KEY set).');
}

const api = {
  '/api/checkout': createCheckoutHandler({ getStripe, env }),
  '/api/calculate': createCalculateHandler({ getStripe, env }),
};

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.csv': 'text/csv', '.xml': 'application/xml', '.txt': 'text/plain', '.pdf': 'application/pdf',
};

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve(null); }
    });
  });
}

http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, ORIGIN).pathname);

  if (fake && fake.handle(req, res)) return;

  // Serve a config with payments on, like a Vercel deploy with ENABLE_STRIPE=true.
  if (pathname === '/js/config.js') {
    res.setHeader('Content-Type', 'application/javascript');
    return res.end(`window.APP_CONFIG = ${JSON.stringify({
      ENABLE_STRIPE: true,
      PRICE_LABEL: process.env.PRICE_LABEL || '',
    })};`);
  }

  if (api[pathname]) {
    req.body = await readJson(req);
    return api[pathname](req, res);
  }

  let file = path.join(ROOT, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Dev server on ${ORIGIN}`));
