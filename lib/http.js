// Small JSON helpers shared by the /api handlers (plain Node res/req, so the
// same code runs on Vercel and in scripts/dev-server.js).

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function fail(res, status, error, message, extra) {
  send(res, status, { error, message, ...extra });
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return null;
}

module.exports = { send, fail, parseBody };
