const express = require('express');
const DomainEventOutbox = require('../../schemas/DomainEventOutboxSchema');
const OperationalAlert = require('../../schemas/OperationalAlertSchema');
const { getMetrics } = require('../../observability/observability');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session?.userId || req.session.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  return next();
}

router.get('/api/ops/metrics', requireAdmin, (req, res) => {
  return res.json({ success: true, metrics: getMetrics() });
});

router.get('/api/admin/ops/alerts', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const alerts = await OperationalAlert.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const aggregation = await OperationalAlert.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    },
    {
      $group: {
        _id: { alertType: '$alertType', state: '$state' },
        count: { $sum: 1 }
      }
    }
  ]);

  return res.json({ success: true, alerts, aggregation });
});

router.get('/api/admin/ops/dead-letter-events', requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 300);
  const items = await DomainEventOutbox.find({ status: 'dead_letter' })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return res.json({ success: true, count: items.length, items });
});

router.post('/api/admin/ops/dead-letter-events/:eventId/replay', requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  const replayed = await DomainEventOutbox.findOneAndUpdate(
    {
      eventId,
      status: 'dead_letter'
    },
    {
      $set: {
        status: 'pending',
        nextAttemptAt: new Date(),
        lockedAt: null,
        error: null,
        deadLetteredAt: null,
        deadLetterReason: null,
        updatedAt: new Date(),
        lastReplayAt: new Date(),
        replayedBy: req.session.userId
      },
      $inc: { replayCount: 1 }
    },
    { new: true }
  ).lean();

  if (!replayed) {
    return res.status(404).json({ success: false, error: 'Dead-letter event not found' });
  }

  return res.json({
    success: true,
    replayed: {
      eventId: replayed.eventId,
      status: replayed.status,
      replayCount: replayed.replayCount
    }
  });
});

module.exports = router;