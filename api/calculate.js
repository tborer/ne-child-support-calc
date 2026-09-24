// POST /api/calculate — verify payment and return the calculation result.
const { createCalculateHandler, stripeFromEnv } = require('../lib/payments');

module.exports = createCalculateHandler({ getStripe: stripeFromEnv() });
