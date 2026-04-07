const QuotaConfig = require('../../schemas/QuotaConfigSchema');
const QuotaAuditLog = require('../../schemas/QuotaAuditLogSchema');
const QuotaWorkflowPlan = require('../../schemas/QuotaWorkflowPlanSchema');
const QuotaNotificationBatch = require('../../schemas/QuotaNotificationBatchSchema');
const { StudentCollection } = require('../../config/config');
const { validateQuota } = require('../../utils/quotaConfig');
const {
  previewEvictionPlan,
  planEviction,
  finalizeQuota,
  getAvailableCapacity
} = require('../../services/academicYearTransitionService');
const {
  buildQuotaRealDataComparison,
  buildMultiYearQuotaTrend,
  recommendQuotaFromTrends
} = require('../../services/quotaComparisonService');
const {
  upsertWorkflowPlan,
  evaluateOverCapViolations,
  planQuotaNotificationBatch,
  sendQuotaNotificationBatch
} = require('../../services/quotaWorkflowService');

const YEAR_GROUPS = ['year1', 'year2', 'year3', 'year4_plus'];

function parseNumber(value, defaultValue = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : defaultValue;
}

function defaultEffectiveWindow(academicYear) {
  const start = Number(String(academicYear || '').slice(0, 4));
  if (!Number.isFinite(start)) {
    const currentYear = new Date().getFullYear();
    return {
      effectiveFrom: new Date(`${currentYear}-08-01T00:00:00.000Z`),
      effectiveTo: new Date(`${currentYear + 1}-07-31T23:59:59.999Z`)
    };
  }

  return {
    effectiveFrom: new Date(`${start}-08-01T00:00:00.000Z`),
    effectiveTo: new Date(`${start + 1}-07-31T23:59:59.999Z`)
  };
}

function extractQuotasFromBody(body = {}, totalCapacity = 0) {
  return YEAR_GROUPS.map((group) => {
    const percentage = parseNumber(body[`${group}_percentage`]);
    const slot = Math.round((totalCapacity * percentage) / 100);

    return {
      yearGroup: group,
      percentage,
      slot
    };
  });
}

function extractQuotaPayload(req) {
  const academicYear = String(req.body.academicYear || '').trim();
  const totalCapacity = parseNumber(req.body.totalCapacity, 0);
  const quotas = extractQuotasFromBody(req.body, totalCapacity);

  const window = defaultEffectiveWindow(academicYear);
  const effectiveFrom = req.body.effectiveFrom
    ? new Date(req.body.effectiveFrom)
    : window.effectiveFrom;
  const effectiveTo = req.body.effectiveTo
    ? new Date(req.body.effectiveTo)
    : window.effectiveTo;

  const overcapEnabled = String(req.body.overcapEnabled || '').toLowerCase() === 'true'
    || req.body.overcapEnabled === 'on';

  const parseOptionalNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const excludeInternationalStudents = String(req.body.excludeInternationalStudents || 'true').toLowerCase() !== 'false';
  const recommendationWindowYears = Math.max(1, parseNumber(req.body.recommendationWindowYears, 3));

  return {
    academicYear,
    totalCapacity,
    quotas,
    overcapPolicy: {
      enabled: overcapEnabled,
      maxOverPercent: parseNumber(req.body.overcapMaxPercent, 0),
      byYearGroup: {
        year1: parseOptionalNumber(req.body.overcap_year1),
        year2: parseOptionalNumber(req.body.overcap_year2),
        year3: parseOptionalNumber(req.body.overcap_year3),
        year4_plus: parseOptionalNumber(req.body.overcap_year4_plus)
      }
    },
    analyticsOptions: {
      excludeInternationalStudents,
      recommendationWindowYears
    },
    effectiveFrom,
    effectiveTo,
    isDraft: true
  };
}

async function getNextVersion(academicYear) {
  const latest = await QuotaConfig.findOne({ academicYear })
    .sort({ version: -1 })
    .select({ version: 1 })
    .lean();

  return (latest?.version || 0) + 1;
}

function quotaToFormData(quota = null) {
  const base = {
    academicYear: '',
    totalCapacity: '',
    effectiveFrom: '',
    effectiveTo: '',
    year1_percentage: 0,
    year1_slot: 0,
    year2_percentage: 0,
    year2_slot: 0,
    year3_percentage: 0,
    year3_slot: 0,
    year4_plus_percentage: 0,
    year4_plus_slot: 0,
    overcapEnabled: false,
    overcapMaxPercent: 0,
    overcap_year1: '',
    overcap_year2: '',
    overcap_year3: '',
    overcap_year4_plus: '',
    excludeInternationalStudents: true,
    recommendationWindowYears: 3,
    reason: ''
  };

  if (!quota) return base;

  const formData = {
    ...base,
    academicYear: quota.academicYear || '',
    totalCapacity: quota.totalCapacity || '',
    effectiveFrom: quota.effectiveFrom ? new Date(quota.effectiveFrom).toISOString().slice(0, 10) : '',
    effectiveTo: quota.effectiveTo ? new Date(quota.effectiveTo).toISOString().slice(0, 10) : '',
    overcapEnabled: !!quota?.overcapPolicy?.enabled,
    overcapMaxPercent: Number(quota?.overcapPolicy?.maxOverPercent || 0),
    overcap_year1: quota?.overcapPolicy?.byYearGroup?.year1 ?? '',
    overcap_year2: quota?.overcapPolicy?.byYearGroup?.year2 ?? '',
    overcap_year3: quota?.overcapPolicy?.byYearGroup?.year3 ?? '',
    overcap_year4_plus: quota?.overcapPolicy?.byYearGroup?.year4_plus ?? '',
    excludeInternationalStudents: quota?.analyticsOptions?.excludeInternationalStudents !== false,
    recommendationWindowYears: Number(quota?.analyticsOptions?.recommendationWindowYears || 3)
  };

  (quota.quotas || []).forEach((entry) => {
    if (!YEAR_GROUPS.includes(entry.yearGroup)) return;
    formData[`${entry.yearGroup}_percentage`] = Number(entry.percentage) || 0;
    formData[`${entry.yearGroup}_slot`] = Number(entry.slot) || 0;
  });

  return formData;
}

function getMessage(req) {
  if (!req.query.message) return null;
  return {
    type: req.query.type || 'success',
    text: decodeURIComponent(req.query.message)
  };
}

function redirectWithMessage(res, path, message, type = 'success') {
  const msg = encodeURIComponent(message);
  res.redirect(`${path}?message=${msg}&type=${type}`);
}

function asObject(document) {
  if (!document) return null;
  return typeof document.toObject === 'function' ? document.toObject() : document;
}

function getActorId(req) {
  return req.session?.userId || null;
}

async function writeAuditLog({ quotaId, action, req, before = null, after = null, reason = '' }) {
  if (!quotaId || !action || !getActorId(req)) return;

  const payload = {
    quotaId,
    action,
    changedBy: getActorId(req),
    before,
    after
  };

  if (reason && String(reason).trim()) {
    payload.reason = String(reason).trim();
  }

  await QuotaAuditLog.create(payload);
}

async function renderQuotaList(req, res) {
  try {
    const academicYear = req.query.academicYear;
    const filter = academicYear ? { academicYear } : {};

    const quotas = await QuotaConfig.find(filter)
      .sort({ academicYear: -1, version: -1, isDraft: -1 })
      .lean();

    res.render('admin/quotas/index', {
      activeNav: 'quotas',
      quotas,
      selectedAcademicYear: academicYear || '',
      message: getMessage(req),
      canManage: !!req.quotaAccess?.canManage
    });
  } catch (error) {
    res.status(500).send(`Cannot load quota list: ${error.message}`);
  }
}

async function renderAuditHistory(req, res) {
  try {
    const academicYear = String(req.query.academicYear || '').trim();
    const quotaId = String(req.query.quotaId || '').trim();

    const quotaFilter = {};
    if (academicYear) {
      quotaFilter.academicYear = academicYear;
    }

    const quotaDocs = await QuotaConfig.find(quotaFilter)
      .sort({ academicYear: -1, version: -1 })
      .select({ _id: 1, academicYear: 1, version: 1, isDraft: 1 })
      .lean();

    const logFilter = {};
    if (quotaId) {
      logFilter.quotaId = quotaId;
    } else if (academicYear) {
      const quotaIds = quotaDocs.map((q) => q._id);
      logFilter.quotaId = { $in: quotaIds };
    }

    const logs = await QuotaAuditLog.find(logFilter)
      .sort({ timestamp: -1 })
      .limit(500)
      .populate('changedBy', 'username name')
      .populate('quotaId', 'academicYear version isDraft')
      .lean();

    const academicYears = [...new Set(quotaDocs.map((q) => q.academicYear))];

    return res.render('admin/quotas/audit-history', {
      activeNav: 'quotas',
      logs,
      quotaOptions: quotaDocs,
      academicYears,
      selectedAcademicYear: academicYear,
      selectedQuotaId: quotaId,
      message: getMessage(req),
      canManage: !!req.quotaAccess?.canManage
    });
  } catch (error) {
    return res.status(500).send(`Cannot load quota audit history: ${error.message}`);
  }
}

function renderCreateForm(req, res) {
  res.render('admin/quotas/form', {
    activeNav: 'quotas',
    mode: 'create',
    quota: null,
    form: quotaToFormData(),
    message: getMessage(req),
    isLocked: false,
    canManage: !!req.quotaAccess?.canManage
  });
}

async function createQuota(req, res) {
  try {
    const payload = extractQuotaPayload(req);
    const validation = validateQuota(payload);

    if (!validation.isValid) {
      return res.status(400).render('admin/quotas/form', {
        activeNav: 'quotas',
        mode: 'create',
        quota: null,
        form: quotaToFormData(payload),
        message: { type: 'error', text: validation.errors.join('; ') },
        isLocked: false,
        canManage: !!req.quotaAccess?.canManage
      });
    }

    const version = await getNextVersion(payload.academicYear);

    const quota = new QuotaConfig({
      ...payload,
      version,
      createdBy: req.session.userId
    });

    await quota.save();

    await writeAuditLog({
      quotaId: quota._id,
      action: 'CREATE',
      req,
      before: null,
      after: asObject(quota)
    });

    redirectWithMessage(res, '/admin/quotas', 'Created quota draft successfully');
  } catch (error) {
    res.status(500).render('admin/quotas/form', {
      activeNav: 'quotas',
      mode: 'create',
      quota: null,
      form: quotaToFormData(extractQuotaPayload(req)),
      message: { type: 'error', text: error.message },
      isLocked: false,
      canManage: !!req.quotaAccess?.canManage
    });
  }
}

async function renderEditForm(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).send('Quota not found');
    }

    const isLocked = !quota.isDraft || !req.quotaAccess?.canManage;

    res.render('admin/quotas/form', {
      activeNav: 'quotas',
      mode: 'edit',
      quota,
      form: quotaToFormData(quota),
      message: getMessage(req),
      isLocked,
      canManage: !!req.quotaAccess?.canManage
    });
  } catch (error) {
    res.status(500).send(`Cannot load edit form: ${error.message}`);
  }
}

async function updateQuota(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id);
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota not found' });
    }

    if (!quota.isDraft) {
      return res.status(400).json({ success: false, error: 'Published quota cannot be edited' });
    }

    const reason = String(req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason is required for quota update' });
    }

    const payload = extractQuotaPayload(req);
    const validation = validateQuota(payload);

    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join('; ') });
    }

    const before = asObject(quota);

    quota.academicYear = payload.academicYear;
    quota.totalCapacity = payload.totalCapacity;
    quota.quotas = payload.quotas;
    quota.effectiveFrom = payload.effectiveFrom;
    quota.effectiveTo = payload.effectiveTo;
    quota.isDraft = true;

    await quota.save();

    await writeAuditLog({
      quotaId: quota._id,
      action: 'UPDATE',
      req,
      before,
      after: asObject(quota),
      reason
    });

    return res.json({ success: true, message: 'Updated quota draft successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function publishQuota(req, res) {
  try {
    const source = await QuotaConfig.findById(req.params.id).lean();
    if (!source) {
      return res.status(404).json({ success: false, error: 'Quota not found' });
    }

    if (!source.isDraft) {
      return res.status(400).json({ success: false, error: 'Only draft quota can be published' });
    }

    const existingPublished = await QuotaConfig.findOne({
      academicYear: source.academicYear,
      isDraft: false
    }).select({ _id: 1, version: 1 }).lean();

    if (existingPublished) {
      return res.status(409).json({
        success: false,
        error: `Năm học ${source.academicYear} đã có quota ban hành (phiên bản #${existingPublished.version}).`
      });
    }

    const nextVersion = await getNextVersion(source.academicYear);

    const publishedDoc = {
      academicYear: source.academicYear,
      totalCapacity: source.totalCapacity,
      quotas: source.quotas,
      overcapPolicy: source.overcapPolicy,
      analyticsOptions: source.analyticsOptions,
      effectiveFrom: source.effectiveFrom,
      effectiveTo: source.effectiveTo,
      isDraft: false,
      version: nextVersion,
      createdBy: req.session.userId
    };

    const validation = validateQuota(publishedDoc);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join('; ') });
    }

    const published = await QuotaConfig.create(publishedDoc);

    await writeAuditLog({
      quotaId: published._id,
      action: 'PUBLISH',
      req,
      before: source,
      after: asObject(published)
    });

    return res.json({
      success: true,
      message: 'Published quota successfully',
      publishedId: published._id,
      version: published.version
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function computePreviewData(quotaDoc) {
  const students = await StudentCollection.find({ role: { $ne: 'admin' } })
    .select({ _id: 1, studentId: 1, username: 1, name: 1, academicYear: 1, enrollmentYear: 1, yearGroup: 1, priorityScore: 1 })
    .lean();

  const preview = previewEvictionPlan(quotaDoc, students, quotaDoc.academicYear);
  const comparisonData = await buildQuotaRealDataComparison(quotaDoc.academicYear, quotaDoc);

  return { preview, comparisonData };
}

async function previewQuota(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota not found' });
    }

    const { preview } = await computePreviewData(quota);

    return res.json({
      success: true,
      quota: {
        id: quota._id,
        academicYear: quota.academicYear,
        version: quota.version,
        isDraft: quota.isDraft
      },
      summary: preview.summary,
      byYearGroup: preview.byYearGroup,
      removalList: preview.removalList
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function renderPreviewPage(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).send('Quota not found');
    }

    const { preview } = await computePreviewData(quota);

    return res.render('admin/quotas/preview', {
      activeNav: 'quotas',
      quota,
      preview,
      message: getMessage(req)
    });
  } catch (error) {
    return res.status(500).send(`Cannot preview quota: ${error.message}`);
  }
}

function buildDashboardRows(quota, comparison) {
  const quotaMap = {
    year1: { percentage: 0, slot: 0 },
    year2: { percentage: 0, slot: 0 },
    year3: { percentage: 0, slot: 0 },
    year4_plus: { percentage: 0, slot: 0 }
  };

  (quota.quotas || []).forEach((entry) => {
    if (!YEAR_GROUPS.includes(entry.yearGroup)) return;
    quotaMap[entry.yearGroup] = {
      percentage: Number(entry.percentage) || 0,
      slot: Number(entry.slot) || 0
    };
  });

  const actualTotal = YEAR_GROUPS.reduce((sum, group) => sum + (Number(comparison[group]?.actual) || 0), 0);

  return YEAR_GROUPS.map((group) => {
    const actual = Number(comparison[group]?.actual) || 0;
    const actualPercentage = actualTotal > 0
      ? Number(((actual / actualTotal) * 100).toFixed(2))
      : 0;

    return {
      yearGroup: group,
      quotaPercentage: quotaMap[group].percentage,
      quotaSlot: quotaMap[group].slot,
      actual,
      actualPercentage,
      usedPercentage: comparison[group]?.usedPercentage,
      status: comparison[group]?.status || 'on_target',
      remainingCapacity: quotaMap[group].slot - actual
    };
  });
}

async function renderDashboardPage(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).send('Quota not found');
    }

    const comparisonData = await buildQuotaRealDataComparison(quota.academicYear, quota, {
      excludeInternationalStudents: quota?.analyticsOptions?.excludeInternationalStudents !== false
    });
    const capacity = await getAvailableCapacity(quota.academicYear);
    const rows = buildDashboardRows(quota, comparisonData.comparison);
    const overCapEvaluation = evaluateOverCapViolations(quota, comparisonData.comparison);

    res.render('admin/quotas/dashboard', {
      activeNav: 'quotas',
      quota,
      rows,
      capacity,
      overCapEvaluation,
      message: getMessage(req),
      canManage: !!req.quotaAccess?.canManage
    });
  } catch (error) {
    res.status(500).send(`Cannot load quota dashboard: ${error.message}`);
  }
}

async function renderWorkflowPage(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).send('Quota not found');
    }

    let workflow = await QuotaWorkflowPlan.findOne({ quotaConfigId: quota._id }).lean();
    if (!workflow && req.quotaAccess?.canManage) {
      workflow = await upsertWorkflowPlan(quota, req.session.userId);
    }
    const batches = await QuotaNotificationBatch.find({ quotaConfigId: quota._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.render('admin/quotas/workflow', {
      activeNav: 'quotas',
      quota,
      workflow,
      batches,
      message: getMessage(req),
      canManage: !!req.quotaAccess?.canManage
    });
  } catch (error) {
    return res.status(500).send(`Cannot load quota workflow: ${error.message}`);
  }
}

async function regenerateWorkflowPlan(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id);
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota not found' });
    }

    const workflow = await upsertWorkflowPlan(quota, req.session.userId);
    return res.json({ success: true, workflow });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function createNotificationBatch(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota not found' });
    }

    const stage = String(req.body.stage || 'PRE_NOTICE').trim();
    const scheduledAt = req.body.scheduledAt || new Date().toISOString();
    const reason = String(req.body.reason || '').trim();

    const planned = await planQuotaNotificationBatch({
      quotaConfig: quota,
      stage,
      scheduledAt,
      reason,
      actorId: req.session.userId
    });

    return res.json({
      success: true,
      batchId: planned.batch._id,
      targeted: planned.targets.length,
      stage: planned.batch.stage
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function sendNotificationBatch(req, res) {
  try {
    const result = await sendQuotaNotificationBatch(req.params.batchId, req.session.userId);
    return res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
      batch: result.batch
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function renderLeadershipDashboard(req, res) {
  try {
    const yearLimit = Math.max(2, parseNumber(req.query.years, 3));
    const published = await QuotaConfig.find({ isDraft: false })
      .sort({ academicYear: -1, version: -1 })
      .lean();

    const uniqueAcademicYears = [...new Set(published.map((item) => item.academicYear))].slice(0, yearLimit);
    const trends = await buildMultiYearQuotaTrend(uniqueAcademicYears, { excludeInternationalStudents: true });

    const latest = trends[0] || null;
    const recommended = latest
      ? recommendQuotaFromTrends(trends, latest.totalCapacity)
      : [];

    return res.render('admin/quotas/leadership-dashboard', {
      activeNav: 'quotas',
      trends,
      latest,
      recommended,
      yearLimit,
      message: getMessage(req),
      canManage: !!req.quotaAccess?.canManage
    });
  } catch (error) {
    return res.status(500).send(`Cannot load leadership dashboard: ${error.message}`);
  }
}

async function finalizeQuotaPlan(req, res) {
  try {
    const quota = await QuotaConfig.findById(req.params.id).lean();
    if (!quota) {
      return res.status(404).json({ success: false, error: 'Quota not found' });
    }

    const actualNewApplications = parseNumber(req.body.actualNewApplications, 0);
    const requestedAvailableCapacity = parseNumber(req.body.availableCapacity, NaN);

    const students = await StudentCollection.find({ role: { $ne: 'admin' } })
      .select({ _id: 1, studentId: 1, username: 1, name: 1, academicYear: 1, enrollmentYear: 1, yearGroup: 1, priorityScore: 1 })
      .lean();

    const plannedEviction = planEviction(quota, students, quota.academicYear, { includeRawRemovalList: true });

    const capacitySnapshot = Number.isFinite(requestedAvailableCapacity)
      ? {
          availableSlots: requestedAvailableCapacity,
          estimatedFreedSlots: 0
        }
      : await getAvailableCapacity(quota.academicYear);

    const finalized = finalizeQuota({
      quotaConfig: quota,
      actualNewApplications,
      availableCapacity: capacitySnapshot,
      plannedEviction
    });

    await writeAuditLog({
      quotaId: quota._id,
      action: 'FINALIZE',
      req,
      before: {
        demand: actualNewApplications,
        availableCapacity: capacitySnapshot
      },
      after: finalized,
      reason: String(req.body.reason || '').trim()
    });

    return res.json({
      success: true,
      quota: {
        id: quota._id,
        academicYear: quota.academicYear,
        version: quota.version,
        isDraft: quota.isDraft
      },
      finalized,
      plannedEviction: {
        estimatedSlotsToFree: plannedEviction.estimatedSlotsToFree,
        byYearGroup: plannedEviction.byYearGroup
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  renderQuotaList,
  renderAuditHistory,
  renderCreateForm,
  createQuota,
  renderEditForm,
  updateQuota,
  publishQuota,
  previewQuota,
  renderPreviewPage,
  renderDashboardPage,
  finalizeQuotaPlan,
  renderWorkflowPage,
  regenerateWorkflowPlan,
  createNotificationBatch,
  sendNotificationBatch,
  renderLeadershipDashboard
};
