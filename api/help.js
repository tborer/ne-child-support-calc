// POST /api/help — email a help request via SMTP.
const { createHelpHandler, transportFromEnv } = require('../lib/help');

module.exports = createHelpHandler({ getTransport: transportFromEnv() });
