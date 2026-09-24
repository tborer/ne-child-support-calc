// Runtime feature-flag configuration for the static site.
//
// scripts/build.js writes a replacement into dist/js/config.js at deploy
// time from the ENABLE_STRIPE and STRIPE_PAYMENT_LINK_URL environment
// variables (Vercel project settings, or GitHub Actions repository
// variables for the GitHub Pages deploy). The values below are only used
// when serving the repo directly for local development — Stripe stays off
// until it is explicitly configured.
window.APP_CONFIG = {
  ENABLE_STRIPE: false,
  STRIPE_PAYMENT_LINK_URL: ''
};
