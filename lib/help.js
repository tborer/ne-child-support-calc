// Help requests: POST /api/help { message, email?, name?, page?, website? }
// Sends the message by SMTP using the SMTP_* environment variables.
//
//   SMTP_HOST, SMTP_PORT   Mail server, e.g. smtp.example.com / 465
//   SMTP_SECURE            "true" for implicit TLS (usually port 465),
//                          "false" for STARTTLS (usually 587)
//   SMTP_USER, SMTP_PASS   Login for the mail server
//   SMTP_FROM              Sender address; also the recipient unless
//                          HELP_TO is set
//   HELP_TO                Optional: where help requests are delivered

const { send, fail, parseBody } = require('./http');

const MAX_MESSAGE = 5000;
const MAX_FIELD = 200;
const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** One-line, length-limited text safe to put in a header or subject. */
function clean(value, max = MAX_FIELD) {
  return typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '';
}

function validateHelp(body) {
  if (!body || typeof body !== 'object') return { error: 'Please enter a message.' };
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return { error: 'Please enter a message.' };
  if (message.length > MAX_MESSAGE) return { error: `Please keep your message under ${MAX_MESSAGE} characters.` };
  const email = clean(body.email);
  if (email && !EMAIL_PATTERN.test(email)) return { error: 'Please enter a valid email address, or leave it blank.' };
  return {
    help: {
      message,
      email,
      name: clean(body.name),
      page: clean(body.page, 300),
    },
  };
}

function smtpConfigured(env) {
  return !!(env.SMTP_HOST && env.SMTP_FROM);
}

/** Build the nodemailer transport options from the environment. */
function transportOptions(env) {
  const port = Number(env.SMTP_PORT) || 587;
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465;
  const options = { host: env.SMTP_HOST, port, secure };
  if (env.SMTP_USER) options.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS || '' };
  return options;
}

function buildMail(help, env) {
  const from = env.SMTP_FROM;
  const lines = [
    help.message,
    '',
    '---',
    `Name: ${help.name || '(not given)'}`,
    `Email: ${help.email || '(not given)'}`,
    `Page: ${help.page || '(unknown)'}`,
    `Sent: ${new Date().toISOString()}`,
  ];
  const mail = {
    from,
    to: env.HELP_TO || from,
    subject: `Help request — NE Child Support Calculator${help.name ? ` (${help.name})` : ''}`,
    text: lines.join('\n'),
  };
  if (help.email) mail.replyTo = help.name ? { name: help.name, address: help.email } : help.email;
  return mail;
}

/**
 * @param {{ getTransport: () => { sendMail: (mail: object) => Promise<any> },
 *           env?: Record<string, string|undefined> }} deps
 */
function createHelpHandler({ getTransport, env = process.env }) {
  return async function help(req, res) {
    if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed', 'Use POST.');
    if (!smtpConfigured(env)) {
      return fail(res, 503, 'help_not_configured', 'The help form is not set up yet.');
    }

    const body = parseBody(req);
    // Honeypot: real visitors never see or fill the "website" field.
    if (body && typeof body.website === 'string' && body.website.trim()) {
      return send(res, 200, { ok: true });
    }
    const { help: helpRequest, error } = validateHelp(body);
    if (error) return fail(res, 400, 'invalid_help', error);

    try {
      await getTransport().sendMail(buildMail(helpRequest, env));
      return send(res, 200, { ok: true });
    } catch (err) {
      console.error('SMTP send error:', err && (err.code || err.message));
      return fail(res, 502, 'send_failed', 'Sorry, your message could not be sent. Please try again later.');
    }
  };
}

/** Lazily construct the real SMTP transport from the SMTP_* variables. */
function transportFromEnv() {
  let transport;
  return () => {
    if (!transport) transport = require('nodemailer').createTransport(transportOptions(process.env));
    return transport;
  };
}

module.exports = { validateHelp, transportOptions, buildMail, createHelpHandler, transportFromEnv };
