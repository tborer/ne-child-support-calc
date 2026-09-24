// In-memory stand-in for the parts of the Stripe SDK the API uses, plus a
// hosted-checkout page served by scripts/dev-server.js. Test-only.

const crypto = require('crypto');

function createFakeStripe(origin) {
  const sessions = new Map();

  const stripe = {
    checkout: {
      sessions: {
        async create(params) {
          const id = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
          const session = {
            id,
            status: 'open',
            payment_status: 'unpaid',
            metadata: { ...params.metadata },
            success_url: params.success_url,
            cancel_url: params.cancel_url,
            url: `${origin}/__fake-stripe/checkout/${id}`,
          };
          sessions.set(id, session);
          return { id, url: session.url };
        },
        async retrieve(id) {
          const session = sessions.get(id);
          if (!session) {
            const err = new Error(`No such checkout.session: '${id}'`);
            err.code = 'resource_missing';
            throw err;
          }
          return { ...session, metadata: { ...session.metadata } };
        },
      },
    },
  };

  /** Handle /__fake-stripe/* requests. Returns true if it handled one. */
  function handle(req, res) {
    const url = new URL(req.url, origin);
    const match = url.pathname.match(/^\/__fake-stripe\/(checkout|pay|cancel)\/([\w]+)$/);
    if (!match) return false;
    const [, action, id] = match;
    const session = sessions.get(id);
    if (!session) {
      res.statusCode = 404;
      res.end('Unknown session');
      return true;
    }
    if (action === 'checkout') {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><title>Fake Stripe Checkout</title>
        <h1>Fake Stripe Checkout</h1>
        <a id="pay" href="/__fake-stripe/pay/${id}">Pay</a>
        <a id="cancel" href="/__fake-stripe/cancel/${id}">Cancel</a>`);
      return true;
    }
    let location = session.cancel_url;
    if (action === 'pay') {
      session.status = 'complete';
      session.payment_status = 'paid';
      location = session.success_url.replace('{CHECKOUT_SESSION_ID}', id);
    }
    res.statusCode = 303;
    res.setHeader('Location', location);
    res.end();
    return true;
  }

  return { stripe, handle, sessions };
}

module.exports = { createFakeStripe };
