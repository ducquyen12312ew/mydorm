/**
 * Centralized response helpers for mobile API routes.
 * Ensures every response follows: { success, data?, error?, meta? }
 */

function ok(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

function fail(res, error, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error });
}

function notFound(res, message = 'Resource not found') {
  return res.status(404).json({ success: false, error: message });
}

function serverError(res, error, context = '') {
  const message = error?.message || String(error);
  return res.status(500).json({ success: false, error: message });
}

function unauthorized(res, message = 'Unauthorized') {
  return res.status(401).json({ success: false, error: message });
}

module.exports = { ok, fail, notFound, serverError, unauthorized };
