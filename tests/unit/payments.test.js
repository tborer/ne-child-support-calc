// Unit tests for the Stripe checkout / verification handlers (lib/payments.js).
const test = require('node:test');
const assert = require('node:assert');
const {
  APP_ID, hashInputs, resolveOrigin, createCheckoutHandler, createCalculateHandler,
} = require('../../lib/payments');

const INPUTS = {
  calcType: 'joint-calc',
  motherIncome: 7000, motherDeductions: 1675.58,
  fatherIncome: 5000, fatherDeductions: 1017.17,
  table1: 1237,
  motherInsurance: 150, fatherInsurance: 0,
  motherCredit: 0, fatherCredit: 0,
  motherSplit: 50, fatherSplit: 50,
};
const SESSION_ID = 'cs_test_a1b2c3d4e5f6g7h8';
const ENV = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PRICE_ID: 'price_123', SITE_URL: 'https://example.com/' };

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
    json() { return JSON.parse(this.body); },
  };
}

function stripeWith(session, calls = []) {
  return () => ({
    checkout: {
      sessions: {
        async create(params) { calls.push(params); return { id: SESSION_ID, url: 'https://checkout.stripe.com/c/pay/x' }; },
        async retrieve(id) {
          if (!session) { const e = new Error('missing'); e.code = 'resource_missing'; throw e; }
          return { id, ...session };
        },
      },
    },
  });
}

const paidSession = (overrides = {}) => ({
  status: 'complete',
  payment_status: 'paid',
  metadata: { app: APP_ID, calc_type: 'joint-calc', inputs_hash: hashInputs(INPUTS) },
  ...overrides,
});

async function call(handler, body, method = 'POST') {
  const res = fakeRes();
  await handler({ method, body }, res);
  return { status: res.statusCode, body: res.json(), headers: res.headers };
}

// ── /api/checkout ──────────────────────────────────────────────────
test('checkout creates a one-time session with the input hash, not the inputs', async () => {
  const calls = [];
  const handler = createCheckoutHandler({ getStripe: stripeWith(null, calls), env: ENV });
  const { status, body, headers } = await call(handler, { inputs: INPUTS });

  assert.strictEqual(status, 200);
  assert.strictEqual(body.url, 'https://checkout.stripe.com/c/pay/x');
  assert.strictEqual(headers['cache-control'], 'no-store');
  const params = calls[0];
  assert.strictEqual(params.mode, 'payment');
  assert.strictEqual(params.allow_promotion_codes, true);
  assert.deepStrictEqual(params.line_items, [{ price: 'price_123', quantity: 1 }]);
  assert.strictEqual(params.success_url, 'https://example.com/calculator.html?session_id={CHECKOUT_SESSION_ID}');
  assert.strictEqual(params.cancel_url, 'https://example.com/calculator.html?checkout=canceled');
  assert.deepStrictEqual(params.metadata, { app: APP_ID, calc_type: 'joint-calc', inputs_hash: hashInputs(INPUTS) });
  assert.ok(!JSON.stringify(params).includes('1675.58'), 'raw inputs must not be sent to Stripe');
});

test('checkout returns 503 when Stripe is not configured', async () => {
  const handler = createCheckoutHandler({ getStripe: stripeWith(null), env: { SITE_URL: 'https://example.com' } });
  assert.strictEqual((await call(handler, { inputs: INPUTS })).status, 503);
});

test('checkout rejects invalid inputs and non-POST', async () => {
  const handler = createCheckoutHandler({ getStripe: stripeWith(null), env: ENV });
  assert.strictEqual((await call(handler, { inputs: { ...INPUTS, table1: 'x' } })).status, 400);
  assert.strictEqual((await call(handler, {}, 'GET')).status, 405);
});

test("checkout reports Stripe's error code when Stripe rejects the request", async () => {
  const handler = createCheckoutHandler({
    env: ENV,
    getStripe: () => ({ checkout: { sessions: { async create() {
      const err = new Error("No such price: 'price_123'; a similar object exists in live mode");
      err.type = 'StripeInvalidRequestError';
      err.code = 'resource_missing';
      throw err;
    } } } }),
  });
  const { status, body } = await call(handler, { inputs: INPUTS });
  assert.strictEqual(status, 502);
  assert.strictEqual(body.stripeCode, 'resource_missing');
  assert.match(body.message, /\(Stripe: resource_missing\)$/);
  assert.ok(!body.message.includes('price_123'), 'Stripe details stay in the server log');
});

// ── /api/calculate ─────────────────────────────────────────────────
test('calculate returns the result for a paid session with matching inputs', async () => {
  const handler = createCalculateHandler({ getStripe: stripeWith(paidSession()), env: ENV });
  const { status, body } = await call(handler, { sessionId: SESSION_ID, inputs: INPUTS });
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(body, { calcType: 'joint-calc', result: { mother: 70, father: 0 } });
});

test('calculate accepts a session fully covered by a promotion code', async () => {
  const handler = createCalculateHandler({
    getStripe: stripeWith(paidSession({ payment_status: 'no_payment_required' })), env: ENV,
  });
  const { status, body } = await call(handler, { sessionId: SESSION_ID, inputs: INPUTS });
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(body.result, { mother: 70, father: 0 });
});

test('calculate refuses an unpaid session', async () => {
  const handler = createCalculateHandler({
    getStripe: stripeWith(paidSession({ status: 'open', payment_status: 'unpaid' })), env: ENV,
  });
  const { status, body } = await call(handler, { sessionId: SESSION_ID, inputs: INPUTS });
  assert.strictEqual(status, 402);
  assert.strictEqual(body.error, 'payment_required');
  assert.strictEqual(body.result, undefined);
});

test('calculate refuses inputs that differ from the paid ones', async () => {
  const handler = createCalculateHandler({ getStripe: stripeWith(paidSession()), env: ENV });
  const { status, body } = await call(handler, { sessionId: SESSION_ID, inputs: { ...INPUTS, motherIncome: 7001 } });
  assert.strictEqual(status, 403);
  assert.strictEqual(body.error, 'inputs_changed');
});

test("calculate refuses another app's Stripe session", async () => {
  const handler = createCalculateHandler({
    getStripe: stripeWith(paidSession({ metadata: { app: 'something-else' } })), env: ENV,
  });
  assert.strictEqual((await call(handler, { sessionId: SESSION_ID, inputs: INPUTS })).status, 404);
});

test('calculate handles unknown and malformed session ids', async () => {
  const handler = createCalculateHandler({ getStripe: stripeWith(null), env: ENV });
  assert.strictEqual((await call(handler, { sessionId: SESSION_ID, inputs: INPUTS })).status, 404);
  assert.strictEqual((await call(handler, { sessionId: 'anything', inputs: INPUTS })).status, 400);
});

// ── helpers ────────────────────────────────────────────────────────
test('hashInputs is stable and sensitive to every field', () => {
  assert.strictEqual(hashInputs(INPUTS), hashInputs({ ...INPUTS }));
  assert.notStrictEqual(hashInputs(INPUTS), hashInputs({ ...INPUTS, fatherSplit: 49.99 }));
  assert.notStrictEqual(hashInputs(INPUTS), hashInputs({ ...INPUTS, calcType: 'basic-calc' }));
});

test('resolveOrigin prefers the preview URL on previews and SITE_URL otherwise', () => {
  assert.strictEqual(resolveOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: 'x-git.vercel.app', SITE_URL: 'https://a.com' }), 'https://x-git.vercel.app');
  assert.strictEqual(resolveOrigin({ VERCEL_ENV: 'production', SITE_URL: 'https://a.com/' }), 'https://a.com');
  assert.strictEqual(resolveOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'b.com' }), 'https://b.com');
  assert.strictEqual(resolveOrigin({}), null);
});
