/**
 * Unit test thuần cho forecastService (không cần DB).
 * Run: node scripts/test-forecast-service.js
 */
const assert = require('assert');
const { computeForecast, computeAllScenarios } = require('../src/services/forecastService');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('  ✓', name); pass++; }
  catch (e) { console.error('  ✗', name, '\n     ', e.message); fail++; }
}

// Dữ liệu HUST (newest-first), hỗ trợ field cũ totalEnrollmentQuota
const HIST = [
  { academicYear: '2024-2025', totalEnrollmentQuota: 7800, dormApplications: 3980, dormAcceptedStudents: 1240 },
  { academicYear: '2023-2024', totalEnrollmentQuota: 7600, dormApplications: 3820, dormAcceptedStudents: 1180 },
  { academicYear: '2022-2023', totalEnrollmentQuota: 7400, dormApplications: 3520, dormAcceptedStudents: 1100 },
  { academicYear: '2021-2022', totalEnrollmentQuota: 7200, dormApplications: 3250, dormAcceptedStudents: 1020 },
  { academicYear: '2020-2021', totalEnrollmentQuota: 7000, dormApplications: 2680, dormAcceptedStudents: 920 },
  { academicYear: '2019-2020', totalEnrollmentQuota: 6800, dormApplications: 3120, dormAcceptedStudents: 980 }
];
const CAP = 1450;

console.log('\nforecastService tests');

check('B1: applicationRate = apps/quota (nearest-year khớp quota = năm gần nhất)', () => {
  const f = computeForecast(7800, HIST, CAP);
  assert.strictEqual(f.method, 'nearest-year');
  assert.strictEqual(f.referenceYear, '2024-2025');
  assert.strictEqual(f.applicationRate, 51); // 3980/7800 = 51.0%
});

check('B2: quota xa mọi năm (>5%) → weighted-average, referenceYear=null', () => {
  const f = computeForecast(9000, HIST, CAP);
  assert.strictEqual(f.method, 'weighted-average');
  assert.strictEqual(f.referenceYear, null);
});

check('B2: ±5% → nearest-year chọn năm GẦN NHẤT khớp', () => {
  const f = computeForecast(7254, HIST, CAP); // lệch 4.55% so với 2023-2024
  assert.strictEqual(f.method, 'nearest-year');
  assert.strictEqual(f.referenceYear, '2023-2024');
});

check('B3: expectedApplications = round(quota×rate chính xác); accepted ≤ capacity', () => {
  const f = computeForecast(7800, HIST, CAP);
  // nearest-year 2024-2025: rate gốc = 3980/7800 → round(7800 × 3980/7800) = 3980
  assert.strictEqual(f.expectedApplications, 3980);
  assert.ok(f.expectedAccepted <= CAP, 'accepted phải ≤ capacity');
});

check('B4: cảnh báo khi occupancy > 95%', () => {
  const f = computeForecast(7800, HIST, CAP, { manualRatePercent: 60 });
  assert.strictEqual(f.method, 'manual-override');
  assert.ok(f.occupancyRate > 95);
  assert.ok(f.warnings.some(w => w.includes('95%')));
});

check('B4: cảnh báo khi occupancy < 60%', () => {
  const f = computeForecast(7800, HIST, 5000, { manualRatePercent: 30 });
  assert.ok(f.occupancyRate < 60);
  assert.ok(f.warnings.some(w => w.includes('60%')));
});

check('opts.useLastYearRate ép dùng năm index 0', () => {
  const f = computeForecast(9000, HIST, CAP, { useLastYearRate: true });
  assert.strictEqual(f.method, 'nearest-year');
  assert.strictEqual(f.referenceYear, '2024-2025');
});

check('Hỗ trợ field mới enrollmentQuota', () => {
  const hist2 = [{ academicYear: '2024-2025', enrollmentQuota: 7800, dormApplications: 3980, dormAcceptedStudents: 1240 },
                 { academicYear: '2023-2024', enrollmentQuota: 7600, dormApplications: 3820, dormAcceptedStudents: 1180 }];
  const f = computeForecast(7800, hist2, CAP);
  assert.strictEqual(f.applicationRate, 51);
});

check('computeAllScenarios trả về 4 kịch bản + recommended', () => {
  const r = computeAllScenarios(7800, null, HIST, CAP);
  assert.deepStrictEqual(Object.keys(r.scenarios).sort(), ['A', 'B', 'C', 'D']);
  assert.ok(['A', 'B', 'C', 'D'].includes(r.recommended));
  assert.strictEqual(r.scenarios.C.quota, Math.round(7800 * 1.07));
  assert.strictEqual(r.scenarios.D.quota, Math.round(7800 * 0.93));
  assert.ok(typeof r.recommendation === 'string' && r.recommendation.length > 0);
});

check('computeAllScenarios: custom override quota cho B', () => {
  const r = computeAllScenarios(7800, 8200, HIST, CAP);
  assert.strictEqual(r.scenarios.B.quota, 8200);
  assert.strictEqual(r.scenarios.A.quota, 7800);
});

console.log(`\nKết quả: ${pass} pass, ${fail} fail\n`);
process.exit(fail > 0 ? 1 : 0);
