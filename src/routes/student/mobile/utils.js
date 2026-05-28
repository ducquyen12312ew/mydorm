const mongoose = require('mongoose');

function requireStudentAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  if (req.session.role === 'admin') {
    return res.status(403).json({ success: false, error: 'Student access only' });
  }
  return next();
}

function isValidObjectId(value) {
  return value && mongoose.Types.ObjectId.isValid(value);
}

module.exports = { requireStudentAuth, isValidObjectId };
