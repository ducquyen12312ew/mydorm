const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const DemandForecast = require('../../schemas/DemandForecastSchema');
const HistoricalEnrollment = require('../../schemas/HistoricalEnrollmentSchema');
const EnrollmentPlan = require('../../schemas/EnrollmentPlanSchema');
const { DormitoryCollection } = require('../../config/config');
const { computeAllScenarios } = require('../../services/forecastService');
const { getDormCapacity } = require('../../utils/capacityHelper');

// Quy score tin cậy (dùng cho UI) từ mức tin cậy của service
const CONF_SCORE = { high: 85, medium: 65, low: 45 };

// Map kết quả forecastService → shape ScenarioOutput của DemandForecastSchema
function toScenarioOutput(sc, capacity) {
  const f = sc.output;
  return {
    enrollmentQuota: f.enrollmentQuota,
    growthAssumption: sc.growth,
    method: f.method,
    referenceYear: f.referenceYear,
    yearsUsed: f.yearsUsed,
    expectedApplications: f.expectedApplications,
    applicationRate: f.applicationRate,        // %
    expectedAccepted: f.expectedAccepted,
    acceptanceRate: f.avgAcceptanceRate,       // %
    expectedResidents: f.expectedAccepted,
    roomDemand: f.expectedAccepted,
    occupancyRate: f.occupancyRate,
    capacityGap: f.capacityGap,
    surplusDeficit: capacity - f.expectedAccepted,
    confidenceScore: CONF_SCORE[f.confidenceLevel] || 50,
    confidenceLevel: f.confidenceLevel,
    explanation: f.explanation,
    warnings: f.warnings
  };
}

// Main forecast dashboard
router.get('/admin/demand-forecast', isAdmin, async (req, res) => {
  try {
    const forecasts = await DemandForecast.find({}).sort({ academicYear: -1 }).lean();
    const historical = await HistoricalEnrollment.find({}).sort({ academicYear: -1 }).lean();
    const latestForecast = forecasts[0] || null;
    const dormCapacity = await getDormCapacity(DormitoryCollection);

    res.render('admin/demand-forecast/index', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'demandforecast',
      forecasts,
      historical,
      latestForecast,
      dormCapacity
    });
  } catch (err) {
    console.error('[DemandForecast] dashboard error:', err);
    res.status(500).send('Server error');
  }
});

// Generate a forecast for an academic year
router.post('/admin/demand-forecast/generate', isAdmin, async (req, res) => {
  try {
    const { academicYear, customQuota, manualNote, useLastYearRate, manualRatePercent } = req.body;
    if (!academicYear) return res.status(400).json({ error: 'academicYear required' });

    // Load all historical data sorted newest first
    const history = await HistoricalEnrollment.find({}).sort({ academicYear: -1 }).lean();
    if (history.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 years of historical data to generate forecast' });
    }

    // Sức chứa KTX động (Σ maxCapacity của mọi phòng), fallback nếu DB rỗng
    const capacity = await getDormCapacity(DormitoryCollection);

    // Năm gần nhất làm gốc; hỗ trợ field cũ (totalEnrollmentQuota) lẫn mới (enrollmentQuota)
    const prevYear = history[0];
    const prevQuota = prevYear.enrollmentQuota != null ? prevYear.enrollmentQuota : prevYear.totalEnrollmentQuota;
    const custom = customQuota ? parseInt(customQuota) : null;
    const baseQuota = custom || prevQuota;

    // opts ghi đè cho dự báo chính / kịch bản B
    const opts = {};
    if (manualRatePercent != null && manualRatePercent !== '') opts.manualRatePercent = manualRatePercent;
    else if (useLastYearRate === true || useLastYearRate === 'true') opts.useLastYearRate = true;

    // 4 kịch bản từ service
    const { scenarios: scn, recommended, recommendation } =
      computeAllScenarios(prevQuota, custom, history, capacity, opts);

    const scenarioA = toScenarioOutput(scn.A, capacity);
    const scenarioB = toScenarioOutput(scn.B, capacity);
    const scenarioC = toScenarioOutput(scn.C, capacity);
    const scenarioD = toScenarioOutput(scn.D, capacity);

    // Dự báo CHÍNH = kịch bản theo chỉ tiêu admin nhập (B)
    const primary = scenarioB;

    // Upsert forecast
    let forecast = await DemandForecast.findOne({ academicYear });
    if (!forecast) {
      forecast = new DemandForecast({ academicYear, createdBy: req.session.adminId });
    }
    forecast.method = primary.method;
    forecast.referenceYear = primary.referenceYear || null;
    forecast.primaryForecast = primary;
    forecast.yearsUsed = scn.B.output.yearsUsed;
    forecast.dormCapacity = capacity;
    forecast.baseEnrollmentQuota = baseQuota;
    forecast.baseApplicationRate = primary.applicationRate;
    forecast.baseAcceptanceRate = primary.acceptanceRate;
    forecast.scenarios = {
      A: { description: scn.A.description, output: scenarioA },
      B: { description: scn.B.description, customQuota: baseQuota, output: scenarioB },
      C: { description: scn.C.description, growthRate: 0.07, output: scenarioC },
      D: { description: scn.D.description, declineRate: 0.07, output: scenarioD }
    };
    forecast.recommendedScenario = recommended;
    forecast.recommendation = recommendation;
    if (manualNote) {
      forecast.manualOverride = { applied: true, overriddenBy: req.session.adminId, overriddenByName: req.session.adminName, overrideNote: manualNote };
    }
    await forecast.save();

    res.json({ success: true, forecast, recommended, recommendation });
  } catch (err) {
    console.error('[DemandForecast] generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manual override for a specific scenario
router.post('/admin/demand-forecast/:id/override', isAdmin, async (req, res) => {
  try {
    const { scenario, overrideData, note } = req.body;
    const forecast = await DemandForecast.findById(req.params.id);
    if (!forecast) return res.status(404).json({ error: 'Not found' });
    if (!['A', 'B', 'C', 'D'].includes(scenario)) return res.status(400).json({ error: 'Invalid scenario' });

    const original = JSON.parse(JSON.stringify(forecast.scenarios[scenario].output));
    Object.assign(forecast.scenarios[scenario].output, overrideData);
    forecast.manualOverride = {
      applied: true,
      overriddenBy: req.session.adminId,
      overriddenByName: req.session.adminName,
      originalValues: { [scenario]: original },
      overrideNote: note
    };
    forecast.markModified('scenarios');
    await forecast.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[DemandForecast] override error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// JSON: historical data
router.get('/admin/api/demand-forecast/historical', isAdmin, async (req, res) => {
  try {
    const records = await HistoricalEnrollment.find({}).sort({ academicYear: 1 }).lean();
    res.json({ records, total: records.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// JSON: all forecasts summary
router.get('/admin/api/demand-forecast/all', isAdmin, async (req, res) => {
  try {
    const forecasts = await DemandForecast.find({}).sort({ academicYear: -1 }).lean();
    res.json({ forecasts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
