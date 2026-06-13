const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/auth');
const DemandForecast = require('../../schemas/DemandForecastSchema');
const HistoricalEnrollment = require('../../schemas/HistoricalEnrollmentSchema');
const EnrollmentPlan = require('../../schemas/EnrollmentPlanSchema');

const DORM_CAPACITY = 1308;

// Main forecast dashboard
router.get('/admin/demand-forecast', isAdmin, async (req, res) => {
  try {
    const forecasts = await DemandForecast.find({}).sort({ academicYear: -1 }).lean();
    const historical = await HistoricalEnrollment.find({}).sort({ academicYear: -1 }).lean();
    const latestForecast = forecasts[0] || null;

    res.render('admin/demand-forecast/index', {
      user: { name: req.session.adminName, role: req.session.adminRole },
      activeNav: 'demandforecast',
      forecasts,
      historical,
      latestForecast,
      dormCapacity: DORM_CAPACITY
    });
  } catch (err) {
    console.error('[DemandForecast] dashboard error:', err);
    res.status(500).send('Server error');
  }
});

// Generate a forecast for an academic year
router.post('/admin/demand-forecast/generate', isAdmin, async (req, res) => {
  try {
    const { academicYear, customQuota, manualNote } = req.body;
    if (!academicYear) return res.status(400).json({ error: 'academicYear required' });

    // Load all historical data sorted newest first
    const history = await HistoricalEnrollment.find({}).sort({ academicYear: -1 }).lean();
    if (history.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 years of historical data to generate forecast' });
    }

    // Find previous year's data
    const [prevYear, yearBefore] = history;

    // Check if current quota ≈ previous quota (within 5%)
    const prevQuota = prevYear.totalEnrollmentQuota;
    const custom = customQuota ? parseInt(customQuota) : null;
    const baseQuota = custom || prevQuota;

    // Ratio method: if custom close to prev, use nearest year ratios
    // Weighted average otherwise
    let method = 'weighted-average';
    let yearsUsed = history.slice(0, Math.min(5, history.length)).map(h => h.academicYear);

    // Base rates from weighted average of available history
    const weights = history.slice(0, 5).map((_, i) => Math.pow(0.7, i));
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    const wAvg = (field) => {
      const vals = history.slice(0, 5);
      return vals.reduce((s, h, i) => s + (h[field] || 0) * weights[i], 0) / totalWeight;
    };

    const baseAppRate = wAvg('dormApplicationRate') || 0.52;
    const baseAccRate = wAvg('dormAcceptanceRate') || 0.80;
    // Retention as fraction of total who stay
    const baseRetention = wAvg('retentionYear2') || 0.60;

    // Year-group distribution from history
    const appRateY1 = wAvg('appRateYear1') || 0.68;
    const appRateY23 = wAvg('appRateYear2_3') || 0.45;
    const appRateY4 = wAvg('appRateYear4Plus') || 0.22;

    // Student population distribution (user requirement)
    // Year 1: 40-45%, Year 2: 25-30%, Year 3: 15-20%, Year 4+: 10-15%
    const totalStudents = baseQuota * 4; // approximate total student body
    const yr1Frac = 0.42, yr2Frac = 0.28, yr3Frac = 0.18, yr4Frac = 0.12;

    function buildScenarioOutput(quota, growth) {
      const total = Math.round(totalStudents * (1 + growth));
      const yr1 = Math.round(quota * 0.95); // ~95% quota fill rate
      const yr23 = Math.round(total * (yr2Frac + yr3Frac));
      const yr4 = Math.round(total * yr4Frac);

      const apps1 = Math.round(yr1 * appRateY1);
      const apps23 = Math.round(yr23 * appRateY23);
      const apps4 = Math.round(yr4 * appRateY4);
      const totalApps = apps1 + apps23 + apps4;

      const accepted = Math.min(Math.round(totalApps * baseAccRate), DORM_CAPACITY);
      const residents = accepted;
      const occupancyRate = Math.round((residents / DORM_CAPACITY) * 1000) / 10;
      const capacityGap = residents - DORM_CAPACITY;

      // Confidence: higher when quota is close to historical average
      const avgHistQuota = wAvg('totalEnrollmentQuota');
      const quotaDrift = Math.abs(quota - avgHistQuota) / (avgHistQuota || 1);
      const confScore = Math.round(Math.max(40, 100 - quotaDrift * 200));
      const confLevel = confScore >= 75 ? 'high' : confScore >= 50 ? 'medium' : 'low';

      const warnings = [];
      if (occupancyRate > 95) warnings.push('Nguy cơ quá tải KTX — cần mở rộng công suất');
      if (occupancyRate < 60) warnings.push('KTX có nguy cơ trống phòng đáng kể');
      if (capacityGap > 0) warnings.push(`Thiếu ${capacityGap} chỗ — cần điều chỉnh chính sách tiếp nhận`);

      return {
        enrollmentQuota: quota,
        growthAssumption: growth,
        expectedApplications: totalApps,
        applicationRate: Math.round(baseAppRate * 1000) / 10,
        expectedAccepted: accepted,
        acceptanceRate: Math.round(baseAccRate * 1000) / 10,
        expectedResidents: residents,
        roomDemand: residents,
        occupancyRate,
        capacityGap,
        surplusDeficit: DORM_CAPACITY - residents,
        byYearGroup: {
          year1: { applications: apps1, residents: Math.round(apps1 * baseAccRate) },
          year2_3: { applications: apps23, residents: Math.round(apps23 * baseAccRate) },
          year4Plus: { applications: apps4, residents: Math.round(apps4 * baseAccRate) }
        },
        confidenceScore: confScore,
        confidenceLevel: confLevel,
        explanation: `Dự báo dựa trên ${yearsUsed.length} năm lịch sử. Tỷ lệ đăng ký KTX trung bình ${Math.round(baseAppRate * 100)}%, tỷ lệ chấp nhận ${Math.round(baseAccRate * 100)}%.`,
        warnings
      };
    }

    const scenarioA = buildScenarioOutput(prevQuota, 0);
    const scenarioB = buildScenarioOutput(custom || prevQuota, 0);
    const scenarioC = buildScenarioOutput(Math.round(prevQuota * 1.07), 0.07);
    const scenarioD = buildScenarioOutput(Math.round(prevQuota * 0.93), -0.07);

    // Recommend scenario based on closest to historical average occupancy
    const avgOccupancy = wAvg('dormOccupancyRate') * 100 || 75;
    const scenarios = { A: scenarioA, B: scenarioB, C: scenarioC, D: scenarioD };
    let recommended = 'A';
    let minDiff = Infinity;
    for (const [key, sc] of Object.entries(scenarios)) {
      const diff = Math.abs(sc.occupancyRate - avgOccupancy);
      if (diff < minDiff) { minDiff = diff; recommended = key; }
    }

    // Upsert forecast
    let forecast = await DemandForecast.findOne({ academicYear });
    if (!forecast) {
      forecast = new DemandForecast({ academicYear, createdBy: req.session.adminId });
    }
    forecast.method = custom ? 'ratio-nearest' : method;
    forecast.yearsUsed = yearsUsed;
    forecast.dormCapacity = DORM_CAPACITY;
    forecast.baseEnrollmentQuota = baseQuota;
    forecast.baseApplicationRate = baseAppRate;
    forecast.baseAcceptanceRate = baseAccRate;
    forecast.baseRetentionRate = baseRetention;
    forecast.scenarios = {
      A: { description: 'Giữ nguyên như năm trước', output: scenarioA },
      B: { description: 'Chỉ tiêu tuỳ chỉnh thủ công', customQuota: custom || prevQuota, output: scenarioB },
      C: { description: 'Tăng trưởng 7%', growthRate: 0.07, output: scenarioC },
      D: { description: 'Giảm 7%', declineRate: 0.07, output: scenarioD }
    };
    forecast.recommendedScenario = recommended;
    forecast.recommendation = `Kịch bản ${recommended} phù hợp nhất với xu hướng lịch sử (tỷ lệ lấp đầy trung bình ${Math.round(avgOccupancy)}%).`;
    if (manualNote) {
      forecast.manualOverride = { applied: true, overriddenBy: req.session.adminId, overriddenByName: req.session.adminName, overrideNote: manualNote };
    }
    await forecast.save();

    res.json({ success: true, forecast, recommended, recommendation: forecast.recommendation });
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
