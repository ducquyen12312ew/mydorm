/**
 * forecastService — Dự báo nhu cầu KTX. Thuần JS, KHÔNG import Mongoose (unit-testable).
 *
 * 4 bước:
 *  1. applicationRate[i] = dormApplications[i] / enrollmentQuota[i]
 *  2. |quota - quota_năm| / quota_năm ≤ 5% → nearest-year (tỷ lệ năm gần nhất khớp);
 *     ngược lại → weighted-average, w = 0.7^i (i=0 = mới nhất)
 *  3. expectedApplications = round(quota × rate)
 *     expectedAccepted     = min(round(apps × avgAccRate), dormCapacity)
 *  4. Cảnh báo nếu occupancyRate > 95% hoặc < 60%
 */

const NEAR_THRESHOLD = 0.05;
const WEIGHT_DECAY = 0.7;

const round = (n) => Math.round(n);
const round1 = (n) => Math.round(n * 10) / 10;

/** Chuẩn hoá 1 bản ghi: hỗ trợ cả tên field cũ (totalEnrollmentQuota) lẫn mới (enrollmentQuota). */
function normalize(h) {
  const quota = h.enrollmentQuota != null ? h.enrollmentQuota : h.totalEnrollmentQuota;
  const apps = h.dormApplications || 0;
  const accepted = h.dormAcceptedStudents != null ? h.dormAcceptedStudents : (h.dormResidents || 0);
  return {
    academicYear: h.academicYear,
    enrollmentQuota: quota || 0,
    dormApplications: apps,
    dormAcceptedStudents: accepted,
    applicationRate: quota > 0 ? apps / quota : 0,        // B1
    acceptanceRate: apps > 0 ? accepted / apps : 0
  };
}

/**
 * @param {number} quota        Chỉ tiêu tuyển sinh năm dự báo
 * @param {Array}  history      Bản ghi lịch sử (newest-first; sẽ tự sort lại cho chắc)
 * @param {number} dormCapacity Tổng sức chứa KTX
 * @param {Object} [opts]       { useLastYearRate?:bool, manualRatePercent?:number }
 */
function computeForecast(quota, history, dormCapacity, opts = {}) {
  if (!quota || quota <= 0) throw new Error('quota phải là số dương');
  if (!Array.isArray(history) || history.length === 0) throw new Error('Cần ít nhất 1 năm dữ liệu lịch sử');

  const records = history
    .map(normalize)
    .filter(r => r.enrollmentQuota > 0)
    .sort((a, b) => (a.academicYear < b.academicYear ? 1 : -1)); // newest-first

  if (records.length === 0) throw new Error('Không có bản ghi lịch sử hợp lệ');

  const weights = records.map((_, i) => Math.pow(WEIGHT_DECAY, i));
  const totalW = weights.reduce((s, w) => s + w, 0);
  const wAvg = (sel) => records.reduce((s, r, i) => s + sel(r) * weights[i], 0) / totalW;

  const avgAccRate = wAvg(r => r.acceptanceRate);
  const yearsUsed = records.map(r => r.academicYear);

  // B2 + opts
  let method, referenceYear = null, rate, explanation;
  const manualRate = (opts.manualRatePercent != null && opts.manualRatePercent !== '')
    ? Number(opts.manualRatePercent) / 100 : null;

  if (manualRate != null && !Number.isNaN(manualRate)) {
    method = 'manual-override';
    rate = manualRate;
    explanation = `Tỷ lệ đăng ký do admin nhập tay (${round1(rate * 100)}%).`;
  } else if (opts.useLastYearRate) {
    method = 'nearest-year';
    referenceYear = records[0].academicYear;
    rate = records[0].applicationRate;
    explanation = `Dùng tỷ lệ đăng ký năm gần nhất (${referenceYear}) theo yêu cầu admin.`;
  } else {
    const near = records.find(r => Math.abs(quota - r.enrollmentQuota) / r.enrollmentQuota <= NEAR_THRESHOLD);
    if (near) {
      method = 'nearest-year';
      referenceYear = near.academicYear;
      rate = near.applicationRate;
      const drift = round1((Math.abs(quota - near.enrollmentQuota) / near.enrollmentQuota) * 100);
      explanation = `Chỉ tiêu (${quota.toLocaleString('vi-VN')}) gần năm ${near.academicYear} (lệch ${drift}% ≤ 5%) → dùng tỷ lệ năm đó.`;
    } else {
      method = 'weighted-average';
      rate = wAvg(r => r.applicationRate);
      explanation = `Chỉ tiêu không gần năm lịch sử nào (±5%) → trung bình có trọng số ${records.length} năm (w=0.7^i).`;
    }
  }

  // B3
  const expectedApplications = round(quota * rate);
  const expectedAccepted = Math.min(round(expectedApplications * avgAccRate), dormCapacity);

  // B4
  const occupancyRate = dormCapacity > 0 ? round1((expectedAccepted / dormCapacity) * 100) : 0;
  const capacityGap = expectedAccepted - dormCapacity;
  const warnings = [];
  if (occupancyRate > 95) warnings.push(`Lấp đầy dự kiến ${occupancyRate}% > 95% — nguy cơ quá tải KTX.`);
  if (occupancyRate < 60) warnings.push(`Lấp đầy dự kiến ${occupancyRate}% < 60% — nguy cơ trống phòng.`);
  if (capacityGap > 0) warnings.push(`Thiếu ${capacityGap.toLocaleString('vi-VN')} chỗ so với sức chứa ${dormCapacity.toLocaleString('vi-VN')}.`);

  let confidenceLevel;
  if (method === 'manual-override') confidenceLevel = 'low';
  else if (method === 'nearest-year') confidenceLevel = records.length >= 3 ? 'high' : 'medium';
  else {
    const drift = Math.abs(quota - wAvg(r => r.enrollmentQuota)) / (wAvg(r => r.enrollmentQuota) || 1);
    confidenceLevel = (drift <= 0.1 && records.length >= 3) ? 'medium' : 'low';
  }

  return {
    method,
    referenceYear,
    enrollmentQuota: quota,
    applicationRate: round1(rate * 100),       // %
    avgAcceptanceRate: round1(avgAccRate * 100), // %
    expectedApplications,
    expectedAccepted,
    occupancyRate,
    capacityGap,
    confidenceLevel,
    explanation,
    warnings,
    yearsUsed
  };
}

/**
 * 4 kịch bản: A=prevQuota, B=custom||prevQuota, C=round(prev×1.07), D=round(prev×0.93).
 * @returns {{scenarios:{A,B,C,D}, recommended:string, recommendation:string}}
 */
function computeAllScenarios(prevQuota, custom, history, dormCapacity, opts = {}) {
  const baseB = custom || prevQuota;
  const scenarios = {
    A: { description: 'Giữ nguyên như năm trước', quota: prevQuota, growth: 0,
         output: computeForecast(prevQuota, history, dormCapacity) },
    B: { description: 'Chỉ tiêu tuỳ chỉnh thủ công', quota: baseB,
         growth: custom ? (custom - prevQuota) / prevQuota : 0,
         output: computeForecast(baseB, history, dormCapacity, opts) },
    C: { description: 'Tăng trưởng 7%', quota: round(prevQuota * 1.07), growth: 0.07,
         output: computeForecast(round(prevQuota * 1.07), history, dormCapacity) },
    D: { description: 'Giảm 7%', quota: round(prevQuota * 0.93), growth: -0.07,
         output: computeForecast(round(prevQuota * 0.93), history, dormCapacity) }
  };

  // Khuyến nghị: kịch bản có lấp đầy gần mục tiêu vận hành ~90% nhất
  const TARGET = 90;
  let recommended = 'B', min = Infinity;
  for (const [k, sc] of Object.entries(scenarios)) {
    const diff = Math.abs((sc.output.occupancyRate || 0) - TARGET);
    if (diff < min) { min = diff; recommended = k; }
  }
  const recommendation = `Kịch bản ${recommended} cho lấp đầy ${scenarios[recommended].output.occupancyRate}% — gần mục tiêu ~${TARGET}% nhất. ${scenarios[recommended].output.explanation}`;

  return { scenarios, recommended, recommendation };
}

module.exports = { computeForecast, computeAllScenarios, normalize, NEAR_THRESHOLD, WEIGHT_DECAY };
