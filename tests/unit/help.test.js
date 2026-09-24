// Unit tests for the help-request handler (lib/help.js).
const test = require('node:test');
const assert = require('node:assert');
const { createHelpHandler, transportOptions, validateHelp } = require('../../lib/help');

const ENV = { SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'Calculator <help@example.com>' };

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; },
  };
}

async function call(body, { env = ENV, sendMail } = {}) {
  const sent = [];
  const handler = createHelpHandler({
    env,
    getTransport: () => ({ sendMail: sendMail || (async (mail) => { sent.push(mail); }) }),
  });
  const res = fakeRes();
  await handler({ method: 'POST', body }, res);
  return { status: res.statusCode, body: JSON.parse(res.body), sent };
}

test('sends the message to SMTP_FROM with the visitor as Reply-To', async () => {
  const { status, sent } = await call({
    message: 'My payment went through but no result.', name: 'Pat', email: 'pat@example.org', page: '/calculator.html',
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(sent.length, 1);
  const mail = sent[0];
  assert.strictEqual(mail.from, ENV.SMTP_FROM);
  assert.strictEqual(mail.to, ENV.SMTP_FROM);
  assert.deepStrictEqual(mail.replyTo, { name: 'Pat', address: 'pat@example.org' });
  assert.match(mail.subject, /Help request .* \(Pat\)$/);
  assert.match(mail.text, /^My payment went through but no result\./);
  assert.match(mail.text, /Page: \/calculator\.html/);
});

test('HELP_TO overrides the recipient', async () => {
  const { sent } = await call({ message: 'Hi' }, { env: { ...ENV, HELP_TO: 'owner@example.com' } });
  assert.strictEqual(sent[0].to, 'owner@example.com');
  assert.strictEqual(sent[0].replyTo, undefined);
});

test('rejects an empty message or a bad email', async () => {
  assert.strictEqual((await call({ message: '   ' })).status, 400);
  assert.strictEqual((await call({ message: 'Hi', email: 'not-an-email' })).status, 400);
  assert.strictEqual((await call({ message: 'x'.repeat(5001) })).status, 400);
});

test('strips line breaks from header fields', () => {
  const { help } = validateHelp({ message: 'Hi', name: 'Pat\r\nBcc: evil@example.com' });
  assert.ok(!/[\r\n]/.test(help.name));
});

test('silently drops honeypot submissions', async () => {
  const { status, sent } = await call({ message: 'spam', website: 'http://spam.example' });
  assert.strictEqual(status, 200);
  assert.strictEqual(sent.length, 0);
});

test('503 when SMTP is not configured, 502 when sending fails', async () => {
  assert.strictEqual((await call({ message: 'Hi' }, { env: {} })).status, 503);
  const failed = await call({ message: 'Hi' }, { sendMail: async () => { throw new Error('EAUTH'); } });
  assert.strictEqual(failed.status, 502);
  assert.ok(!failed.body.message.includes('EAUTH'));
});

test('transportOptions reads port, secure and auth', () => {
  assert.deepStrictEqual(
    transportOptions({ SMTP_HOST: 'h', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASS: 'p' }),
    { host: 'h', port: 465, secure: true, auth: { user: 'u', pass: 'p' } });
  assert.deepStrictEqual(transportOptions({ SMTP_HOST: 'h', SMTP_PORT: '587', SMTP_SECURE: 'false' }),
    { host: 'h', port: 587, secure: false });
  // SMTP_SECURE unset: implicit TLS only on 465.
  assert.strictEqual(transportOptions({ SMTP_HOST: 'h', SMTP_PORT: '465' }).secure, true);
});
