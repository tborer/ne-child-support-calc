// Stripe Checkout for per-calculation payments.
//
// Flow:
//   1. POST /api/checkout  { inputs }
//      Validates the inputs and creates a one-time Checkout Session for
//      STRIPE_PRICE_ID. A SHA-256 hash of the inputs is stored in the
//      session metadata; the inputs themselves are not sent to Stripe.
//   2. Stripe redirects back to calculator.html?session_id=cs_...
//   3. POST /api/calculate { sessionId, inputs }
//      Retrieves the session from Stripe, requires it to be paid and to
//      belong to this app, and requires the inputs to hash to the stored
//      value. Only then is the result computed and returned.
//
// One payment therefore unlocks exactly one set of inputs. Re-requesting the
// same inputs (a page refresh, printing) is free; changing any number needs a
// new payment.

const crypto = require('crypto');
const { FIELDS, validateInputs, calculateSupport } = require('./calc');
const { send, fail, parseBody } = require('./http');

const APP_ID = 'ne-child-support-calc';
const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

/** Stable hash of validated inputs (fixed field order, numbers normalized). */
function hashInputs(inputs) {
  const canonical = [inputs.calcType, ...FIELDS.map((f) => String(inputs[f]))].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * The public origin Stripe should send customers back to.
 * Preview deployments return to their own URL; production uses SITE_URL.
 */
function resolveOrigin(env) {
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, '');
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return null;
}

/** Stripe's short error code (e.g. "resource_missing"), or its error type. */
function stripeErrorCode(err) {
  if (!err) return '';
  const code = err.code || (typeof err.type === 'string' && err.type.startsWith('Stripe') ? err.type : '');
  return /^[\w.-]{1,60}$/.test(code) ? code : '';
}

/**
 * @param {{ getStripe: () => any, env?: Record<string, string|undefined> }} deps
 */
function createCheckoutHandler({ getStripe, env = process.env }) {
  return async function checkout(req, res) {
    if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed', 'Use POST.');
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
      return fail(res, 503, 'payments_not_configured', 'Online payment is not set up yet.');
    }
    const origin = resolveOrigin(env);
    if (!origin) return fail(res, 503, 'payments_not_configured', 'SITE_URL is not set.');

    const body = parseBody(req);
    const { inputs, error } = validateInputs(body && body.inputs);
    if (error) return fail(res, 400, 'invalid_inputs', error);

    try {
      const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
        submit_type: 'pay',
        // Show the "Add promotion code" field. Codes are managed in the
        // Stripe Dashboard (Product catalog → Coupons → promotion codes).
        allow_promotion_codes: true,
        success_url: `${origin}/calculator.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/calculator.html?checkout=canceled`,
        metadata: {
          app: APP_ID,
          calc_type: inputs.calcType,
          inputs_hash: hashInputs(inputs),
        },
      });
      return send(res, 200, { url: session.url });
    } catch (err) {
      // Log the full Stripe message (visible in Vercel's function logs) and
      // return only Stripe's short error code, which is safe to show.
      console.error('Stripe checkout error:', err && err.type, err && err.code, err && err.message);
      const code = stripeErrorCode(err);
      return fail(res, 502, 'stripe_error',
        `Could not start checkout. Please try again.${code ? ` (Stripe: ${code})` : ''}`,
        code ? { stripeCode: code } : undefined);
    }
  };
}

/**
 * @param {{ getStripe: () => any, env?: Record<string, string|undefined> }} deps
 */
function createCalculateHandler({ getStripe, env = process.env }) {
  return async function calculate(req, res) {
    if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed', 'Use POST.');
    if (!env.STRIPE_SECRET_KEY) {
      return fail(res, 503, 'payments_not_configured', 'Online payment is not set up yet.');
    }

    const body = parseBody(req) || {};
    const sessionId = body.sessionId;
    if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
      return fail(res, 400, 'invalid_session', 'Missing or malformed payment session.');
    }
    const { inputs, error } = validateInputs(body.inputs);
    if (error) return fail(res, 400, 'invalid_inputs', error);

    let session;
    try {
      session = await getStripe().checkout.sessions.retrieve(sessionId);
    } catch (err) {
      if (err && err.code === 'resource_missing') {
        return fail(res, 404, 'session_not_found', 'That payment session was not found.');
      }
      console.error('Stripe retrieve error:', err && err.message);
      return fail(res, 502, 'stripe_error', 'Could not verify payment. Please try again.');
    }

    const metadata = session.metadata || {};
    if (metadata.app !== APP_ID) {
      return fail(res, 404, 'session_not_found', 'That payment session was not found.');
    }
    const paid = session.status === 'complete' &&
      (session.payment_status === 'paid' || session.payment_status === 'no_payment_required');
    if (!paid) {
      return fail(res, 402, 'payment_required', 'Payment has not been completed for this calculation.');
    }
    if (metadata.inputs_hash !== hashInputs(inputs)) {
      return fail(res, 403, 'inputs_changed',
        'These numbers are different from the ones you paid for. Each set of numbers is a separate calculation.');
    }

    return send(res, 200, { calcType: inputs.calcType, result: calculateSupport(inputs) });
  };
}

/** Lazily construct the real Stripe client from STRIPE_SECRET_KEY. */
function stripeFromEnv() {
  let client;
  return () => {
    if (!client) client = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return client;
  };
}

module.exports = {
  APP_ID,
  hashInputs,
  resolveOrigin,
  createCheckoutHandler,
  createCalculateHandler,
  stripeFromEnv,
};
