const QuotaWorkflowPlan = require('../schemas/QuotaWorkflowPlanSchema');
const QuotaNotificationBatch = require('../schemas/QuotaNotificationBatchSchema');
const { StudentCollection, NotificationCollection } = require('../config/config');
const { planEviction } = require('./academicYearTransitionService');

function asDate(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function buildDefaultMilestones(quotaConfig) {
  const from = asDate(quotaConfig?.effectiveFrom, Date.now());
  const to = asDate(quotaConfig?.effectiveTo, addDays(from, 365));

  return [
    {
      key: 'annual_rebalance',
      title: 'Annual quota rebalance approved',
      description: 'Chot quota cho nam hoc moi va xac nhan policy over-cap.',
      dueDate: addDays(from, -30),
      status: 'PENDING'
    },
    {
      key: 'pre_notice_round',
      title: 'Round 1 notice to potentially affected students',
      description: 'Gui thong bao du kien tra phong cho nhom co nguy co vuot quota.',
      dueDate: addDays(from, -21),
      status: 'PENDING'
    },
    {
      key: 'final_notice_round',
      title: 'Round 2 final notice',
      description: 'Chot danh sach can tra phong theo nhu cau thuc te sat ngay don tan sinh vien.',
      dueDate: addDays(from, -7),
      status: 'PENDING'
    },
    {
      key: 'new_year_effective',
      title: 'Quota effective date',
      description: 'Ap dung quota version moi cho nam hoc.',
      dueDate: from,
      status: 'PENDING'
    },
    {
      key: 'mid_year_adjustment',
      title: 'Mid-year micro adjustment checkpoint',
      description: 'Cho phep vi chinh nho trong nam hoc neu co chenh lech cau-thue.',
      dueDate: addDays(from, 120),
      status: 'PENDING'
    },
    {
      key: 'graduation_checkout_checkpoint',
      title: 'Graduation checkout checkpoint',
      description: 'Thong ke sinh vien nam cuoi tra phong truoc dot tiep nhan moi.',
      dueDate: addDays(to, -45),
      status: 'PENDING'
    }
  ];
}

async function upsertWorkflowPlan(quotaConfig, actorId) {
  const payload = {
    academicYear: quotaConfig.academicYear,
    quotaConfigId: quotaConfig._id,
    milestones: buildDefaultMilestones(quotaConfig),
    generatedBy: actorId,
    generatedAt: new Date()
  };

  const plan = await QuotaWorkflowPlan.findOneAndUpdate(
    {
      academicYear: quotaConfig.academicYear,
      quotaConfigId: quotaConfig._id
    },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return plan;
}

function buildOverCapLimitMap(quotaConfig) {
  const policy = quotaConfig?.overcapPolicy || {};
  const defaultPercent = Number(policy.maxOverPercent || 0);
  const byGroup = policy.byYearGroup || {};

  return {
    year1: Number(byGroup.year1 ?? defaultPercent),
    year2: Number(byGroup.year2 ?? defaultPercent),
    year3: Number(byGroup.year3 ?? defaultPercent),
    year4_plus: Number(byGroup.year4_plus ?? defaultPercent)
  };
}

function evaluateOverCapViolations(quotaConfig, comparisonRows = {}) {
  const policy = quotaConfig?.overcapPolicy || {};
  if (!policy.enabled) {
    return { enabled: false, violations: [] };
  }

  const limits = buildOverCapLimitMap(quotaConfig);
  const groups = ['year1', 'year2', 'year3', 'year4_plus'];

  const violations = groups
    .map((group) => {
      const row = comparisonRows[group] || {};
      const quotaSlot = Number(row.quotaSlot || 0);
      const actual = Number(row.actual || 0);
      const capPercent = Number(limits[group] || 0);
      const maxAllowed = quotaSlot + Math.ceil((quotaSlot * capPercent) / 100);
      const exceeded = actual > maxAllowed;

      return {
        yearGroup: group,
        quotaSlot,
        actual,
        maxAllowed,
        overCapPercent: capPercent,
        exceeded,
        excess: exceeded ? actual - maxAllowed : 0
      };
    })
    .filter((item) => item.exceeded);

  return {
    enabled: true,
    violations
  };
}

async function planQuotaNotificationBatch({ quotaConfig, stage, scheduledAt, reason, actorId }) {
  const students = await StudentCollection.find({ role: { $ne: 'admin' } })
    .select({ _id: 1, studentId: 1, username: 1, name: 1, academicYear: 1, enrollmentYear: 1, yearGroup: 1, priorityScore: 1 })
    .lean();

  const evictionPlan = planEviction(quotaConfig, students, quotaConfig.academicYear, { includeRawRemovalList: true });
  const targets = evictionPlan.removalList || [];

  const batch = await QuotaNotificationBatch.create({
    quotaConfigId: quotaConfig._id,
    academicYear: quotaConfig.academicYear,
    stage,
    reason: String(reason || '').trim(),
    scheduledAt: asDate(scheduledAt, Date.now()),
    status: 'PLANNED',
    targetStudentIds: targets.map((item) => item._id).filter(Boolean),
    stats: {
      targeted: targets.length,
      sent: 0,
      failed: 0
    },
    createdBy: actorId
  });

  return {
    batch,
    targets
  };
}

async function sendQuotaNotificationBatch(batchId, actorId) {
  const batch = await QuotaNotificationBatch.findById(batchId).lean();
  if (!batch) {
    throw new Error('Notification batch not found');
  }

  if (batch.status === 'SENT') {
    return {
      batch,
      sent: batch.stats?.sent || 0,
      failed: batch.stats?.failed || 0,
      skipped: true
    };
  }

  const students = await StudentCollection.find({ _id: { $in: batch.targetStudentIds || [] } })
    .select({ _id: 1, name: 1, username: 1 })
    .lean();

  let sent = 0;
  let failed = 0;

  for (const student of students) {
    try {
      await NotificationCollection.create({
        userId: student._id,
        type: 'system',
        title: 'Thong bao quota KTX',
        message: 'Ban thuoc nhom can theo doi tra phong theo ke hoach quota moi. Vui long kiem tra thong bao chi tiet va moc thoi gian.',
        description: `Dot ${batch.stage} - Nam hoc ${batch.academicYear}`,
        channels: {
          inApp: true,
          email: false,
          sms: false
        },
        status: 'sent',
        sentAt: new Date(),
        read: false,
        priority: 'high'
      });
      sent += 1;
    } catch (error) {
      failed += 1;
    }
  }

  const updatedBatch = await QuotaNotificationBatch.findByIdAndUpdate(
    batch._id,
    {
      $set: {
        status: 'SENT',
        sentBy: actorId,
        sentAt: new Date(),
        'stats.sent': sent,
        'stats.failed': failed
      }
    },
    { new: true }
  ).lean();

  return {
    batch: updatedBatch,
    sent,
    failed,
    skipped: false
  };
}

module.exports = {
  upsertWorkflowPlan,
  evaluateOverCapViolations,
  planQuotaNotificationBatch,
  sendQuotaNotificationBatch
};
