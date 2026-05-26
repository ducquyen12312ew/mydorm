const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const MobileRefreshToken = require('../schemas/MobileRefreshTokenSchema');

const ACCESS_TOKEN_TTL = process.env.MOBILE_ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.MOBILE_REFRESH_TOKEN_TTL || '30d';
const ACCESS_SECRET = process.env.MOBILE_JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET || 'mobile-access-secret-dev';
const REFRESH_SECRET = process.env.MOBILE_JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET || 'mobile-refresh-secret-dev';
const ALERT_ON_TOKEN_ANOMALY = String(process.env.MOBILE_ALERT_ON_TOKEN_ANOMALY || 'true') === 'true';
const INVALIDATE_ON_TOKEN_ANOMALY = String(process.env.MOBILE_INVALIDATE_ON_TOKEN_ANOMALY || 'false') === 'true';
const HIGH_RISK_SCORE_THRESHOLD = Number(process.env.MOBILE_ANOMALY_RISK_THRESHOLD || 70);

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function parseExpiryToMs(expiry) {
  const unit = expiry.slice(-1);
  const value = Number(expiry.slice(0, -1));

  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 's') return value * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

async function issueMobileTokens(user, metadata = {}) {
  const subject = String(user._id);
  const deviceId = String(metadata.deviceId || 'unknown-device');
  const fingerprint = String(metadata.fingerprint || 'unknown-fingerprint');

  const accessToken = jwt.sign(
    { sub: subject, role: user.role, typ: 'access' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const refreshToken = jwt.sign(
    {
      sub: subject,
      role: user.role,
      typ: 'refresh',
      jti: crypto.randomBytes(24).toString('hex')
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );

  await MobileRefreshToken.create({
    userId: user._id,
    deviceId,
    fingerprint,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + parseExpiryToMs(REFRESH_TOKEN_TTL))
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL,
    refreshTokenExpiresIn: REFRESH_TOKEN_TTL
  };
}

function verifyMobileAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

async function rotateFingerprint(record, metadata) {
  record.fingerprintHistory = record.fingerprintHistory || [];
  record.fingerprintHistory.push({
    fingerprint: record.fingerprint,
    seenAt: new Date()
  });
  record.fingerprint = metadata.fingerprint;
  record.lastUsedAt = new Date();
  await record.save();
}

function computeRiskScore(stored, metadata) {
  let risk = 0;

  if (stored.deviceId !== metadata.deviceId) {
    risk += 100;
  }

  if (stored.fingerprint !== metadata.fingerprint) {
    risk += 35;
    const oldPlatform = String(stored.fingerprint || '').split('|')[1] || '';
    const newPlatform = String(metadata.fingerprint || '').split('|')[1] || '';
    if (oldPlatform && newPlatform && oldPlatform === newPlatform) {
      risk -= 20;
    }
  }

  if (metadata.ipAddress && stored.lastIpAddress && metadata.ipAddress !== stored.lastIpAddress) {
    risk += 20;
  }

  if (metadata.userAgentHash && stored.lastUserAgentHash && metadata.userAgentHash !== stored.lastUserAgentHash) {
    risk += 25;
  }

  const minutesSinceLastUse = stored.lastUsedAt ? (Date.now() - new Date(stored.lastUsedAt).getTime()) / 60000 : null;
  if (minutesSinceLastUse !== null && minutesSinceLastUse <= 10 && risk > 0) {
    risk += 10;
  }

  return Math.max(0, Math.min(100, risk));
}

async function handleAnomaly(stored, metadata, reason) {
  stored.anomalyCount = (stored.anomalyCount || 0) + 1;
  stored.lastAnomalyAt = new Date();
  stored.lastAnomalyReason = reason;
  if (metadata.ipAddress) {
    stored.lastIpAddress = metadata.ipAddress;
  }
  if (metadata.userAgentHash) {
    stored.lastUserAgentHash = metadata.userAgentHash;
  }
  if (INVALIDATE_ON_TOKEN_ANOMALY) {
    stored.revokedAt = new Date();
    stored.revokedReason = 'SUSPICIOUS_ACTIVITY';
  }
  await stored.save();
  if (ALERT_ON_TOKEN_ANOMALY) {
    console.warn('Mobile token anomaly detected', {
      userId: String(stored.userId),
      deviceId: stored.deviceId,
      reason
    });
  }
}

async function rotateRefreshToken(refreshToken, metadata = {}) {
  const payload = jwt.verify(refreshToken, REFRESH_SECRET);
  if (payload.typ !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }

  const deviceId = String(metadata.deviceId || 'unknown-device');
  const fingerprint = String(metadata.fingerprint || 'unknown-fingerprint');

  const currentHash = sha256(refreshToken);
  const stored = await MobileRefreshToken.findOne({ tokenHash: currentHash, revokedAt: null });

  if (!stored || stored.expiresAt <= new Date()) {
    throw new Error('Refresh token revoked or expired');
  }

  const riskScore = computeRiskScore(stored, {
    ...metadata,
    deviceId,
    fingerprint
  });

  if (riskScore >= HIGH_RISK_SCORE_THRESHOLD) {
    await handleAnomaly(stored, metadata, `HIGH_RISK_${riskScore}`);
    throw new Error('Refresh token rejected due to suspicious activity');
  }

  if (metadata.ipAddress && stored.lastIpAddress && stored.lastIpAddress !== metadata.ipAddress) {
    await handleAnomaly(stored, metadata, 'IP_CHANGED');
  }

  if (metadata.userAgentHash && stored.lastUserAgentHash && stored.lastUserAgentHash !== metadata.userAgentHash) {
    await handleAnomaly(stored, metadata, 'USER_AGENT_CHANGED');
  }

  if (metadata.rotateFingerprint === true) {
    await rotateFingerprint(stored, metadata);
  }

  stored.revokedAt = new Date();
  stored.revokedReason = 'ROTATED';
  stored.lastUsedAt = new Date();
  stored.lastRiskScore = riskScore;

  const replacement = jwt.sign(
    {
      sub: payload.sub,
      role: payload.role,
      typ: 'refresh',
      jti: crypto.randomBytes(24).toString('hex')
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );

  const replacementHash = sha256(replacement);
  stored.replacedByTokenHash = replacementHash;
  await stored.save();

  await MobileRefreshToken.create({
    userId: payload.sub,
    deviceId,
    fingerprint,
    lastIpAddress: metadata.ipAddress || null,
    lastUserAgentHash: metadata.userAgentHash || null,
    tokenHash: replacementHash,
    lastRiskScore: riskScore,
    expiresAt: new Date(Date.now() + parseExpiryToMs(REFRESH_TOKEN_TTL))
  });

  const accessToken = jwt.sign(
    { sub: payload.sub, role: payload.role, typ: 'access' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  return {
    accessToken,
    refreshToken: replacement,
    riskScore,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL,
    refreshTokenExpiresIn: REFRESH_TOKEN_TTL
  };
}

async function revokeRefreshToken(refreshToken) {
  try {
    const tokenHash = sha256(refreshToken);
    await MobileRefreshToken.updateOne(
      { tokenHash, revokedAt: null },
      { revokedAt: new Date(), revokedReason: 'LOGOUT' }
    );
  } catch (_) {
    // Ignore invalid token format in logout.
  }
}

module.exports = {
  issueMobileTokens,
  rotateRefreshToken,
  verifyMobileAccessToken,
  revokeRefreshToken
};
