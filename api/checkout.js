// POST /api/checkout — start a Stripe Checkout for one calculation.
const { createCheckoutHandler, stripeFromEnv } = require('../lib/payments');

module.exports = createCheckoutHandler({ getStripe: stripeFromEnv() });
