// Runtime feature-flag configuration for the static site.
//
// This file is regenerated at deploy time (see .github/workflows/deploy.yml)
// from the ENABLE_STRIPE and STRIPE_PAYMENT_LINK_URL repository variables
// (Settings → Secrets and variables → Actions → Variables). The values
// below are the defaults used for local development and for any deploy
// where those repository variables have not been set — Stripe stays off
// until it is explicitly configured.
window.APP_CONFIG = {
  ENABLE_STRIPE: false,
  STRIPE_PAYMENT_LINK_URL: ''
};
