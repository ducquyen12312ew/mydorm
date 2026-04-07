const { StudentCollection } = require('../config/config');
const QuotaConfig = require('../schemas/QuotaConfigSchema');
const { calculateSlots } = require('../utils/quotaConfig');

const YEAR_GROUPS = ['year1', 'year2', 'year3', 'year4_plus'];
const BASE_K = 66;
const BASE_YEAR = 2020;

function parseAcademicYearStart(academicYear) {
  if (!academicYear || typeof academicYear !== 'string') {
    return new Date().getFullYear();
  }
  const startYear = Number(String(academicYear).split('-')[0]);
  return Number.isFinite(startYear) ? startYear : new Date().getFullYear();
}

function enrollmentYearFromCohortCode(code) {
  const n = Number(String(code || '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(n)) return null;
  return BASE_YEAR + (n - BASE_K);
}

function parseEnrollmentYear(student = {}) {
  if (Number.isFinite(student.enrollmentYear)) {
    return Number(student.enrollmentYear);
  }

  const raw = student.academicYear;
  if (typeof raw === 'number' && raw >= 1900) {
    return raw;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim();
  if (/^K\d+$/i.test(value)) {
    return enrollmentYearFromCohortCode(value);
  }

  if (/^\d{4}$/.test(value)) {
    return Number(value);
  }

  if (/^\d{4}-\d{4}$/.test(value)) {
    return Number(value.slice(0, 4));
  }

  return null;
}

function yearInSchoolToGroup(yearInSchool) {
  if (!Number.isFinite(yearInSchool) || yearInSchool <= 1) return 'year1';
  if (yearInSchool === 2) return 'year2';
  if (yearInSchool === 3) return 'year3';
  return 'year4_plus';
}

function deriveYearGroup(student, referenceAcademicYear) {
  const enrollmentYear = parseEnrollmentYear(student);
  const academicYearStart = parseAcademicYearStart(referenceAcademicYear);

  if (enrollmentYear) {
    const yearInSchool = academicYearStart - enrollmentYear + 1;
    return yearInSchoolToGroup(yearInSchool);
  }

  const numericYear = Number(student?.academicYear);
  if (Number.isFinite(numericYear) && numericYear > 0 && numericYear < 20) {
    return yearInSchoolToGroup(Math.round(numericYear));
  }

  return 'year4_plus';
}

function getDefaultCounts() {
  return {
    year1: 0,
    year2: 0,
    year3: 0,
    year4_plus: 0
  };
}

async function aggregateStudentsByYearGroup(referenceAcademicYear, extraMatch = {}) {
  const academicYearStart = parseAcademicYearStart(referenceAcademicYear);
  const excludeInternationalStudents = extraMatch.excludeInternationalStudents !== false;

  const internationalClause = {
    $or: [
      { isInternational: true },
      {
        nationality: {
          $nin: [null, '', 'VN', 'Viet Nam', 'Vietnam', 'viet nam', 'vietnam']
        }
      },
      {
        citizenship: {
          $nin: [null, '', 'VN', 'Viet Nam', 'Vietnam', 'viet nam', 'vietnam']
        }
      },
      {
        country: {
          $nin: [null, '', 'VN', 'Viet Nam', 'Vietnam', 'viet nam', 'vietnam']
        }
      }
    ]
  };

  const match = {
    role: { $ne: 'admin' },
    ...extraMatch
  };

  delete match.excludeInternationalStudents;

  if (excludeInternationalStudents) {
    match.$nor = [internationalClause];
  }

  const pipeline = [
    {
      $match: {
        ...match
      }
    },
    {
      $project: {
        academicYear: 1,
        enrollmentYear: 1,
        normalizedEnrollmentYear: {
          $switch: {
            branches: [
              {
                case: { $in: [{ $type: '$enrollmentYear' }, ['int', 'long', 'double', 'decimal']] },
                then: { $toInt: '$enrollmentYear' }
              },
              {
                case: {
                  $and: [
                    { $eq: [{ $type: '$academicYear' }, 'string'] },
                    { $regexMatch: { input: '$academicYear', regex: /^K\d+$/i } }
                  ]
                },
                then: {
                  $add: [
                    BASE_YEAR,
                    {
                      $subtract: [
                        { $toInt: { $substrCP: ['$academicYear', 1, 8] } },
                        BASE_K
                      ]
                    }
                  ]
                }
              },
              {
                case: {
                  $and: [
                    { $eq: [{ $type: '$academicYear' }, 'string'] },
                    { $regexMatch: { input: '$academicYear', regex: /^\d{4}$/ } }
                  ]
                },
                then: { $toInt: '$academicYear' }
              },
              {
                case: {
                  $and: [
                    { $eq: [{ $type: '$academicYear' }, 'string'] },
                    { $regexMatch: { input: '$academicYear', regex: /^\d{4}-\d{4}$/ } }
                  ]
                },
                then: { $toInt: { $substrCP: ['$academicYear', 0, 4] } }
              }
            ],
            default: null
          }
        }
      }
    },
    {
      $project: {
        yearInSchool: {
          $cond: [
            { $ne: ['$normalizedEnrollmentYear', null] },
            {
              $add: [
                { $subtract: [academicYearStart, '$normalizedEnrollmentYear'] },
                1
              ]
            },
            null
          ]
        }
      }
    },
    {
      $project: {
        yearGroup: {
          $switch: {
            branches: [
              { case: { $lte: ['$yearInSchool', 1] }, then: 'year1' },
              { case: { $eq: ['$yearInSchool', 2] }, then: 'year2' },
              { case: { $eq: ['$yearInSchool', 3] }, then: 'year3' }
            ],
            default: 'year4_plus'
          }
        }
      }
    },
    {
      $group: {
        _id: '$yearGroup',
        count: { $sum: 1 }
      }
    }
  ];

  const rows = await StudentCollection.aggregate(pipeline);
  const counts = getDefaultCounts();

  rows.forEach((row) => {
    if (YEAR_GROUPS.includes(row._id)) {
      counts[row._id] = row.count;
    }
  });

  return { counts, pipeline };
}

async function buildMultiYearQuotaTrend(academicYears = [], options = {}) {
  const years = Array.isArray(academicYears) ? academicYears : [];
  const rows = [];

  for (const academicYear of years) {
    const publishedQuota = await QuotaConfig.findOne({ academicYear, isDraft: false })
      .sort({ version: -1 })
      .lean();

    if (!publishedQuota) {
      continue;
    }

    const comparisonData = await buildQuotaRealDataComparison(academicYear, publishedQuota, options);

    rows.push({
      academicYear,
      totalCapacity: publishedQuota.totalCapacity,
      version: publishedQuota.version,
      quotas: normalizeQuotaMap(publishedQuota),
      actual: comparisonData.actualCounts,
      comparison: comparisonData.comparison
    });
  }

  return rows;
}

function recommendQuotaFromTrends(trends = [], totalCapacity = 0) {
  if (!Array.isArray(trends) || trends.length === 0) {
    return [];
  }

  const denominator = trends.length;
  const averagePercent = {
    year1: 0,
    year2: 0,
    year3: 0,
    year4_plus: 0
  };

  trends.forEach((row) => {
    const actual = row.actual || {};
    const total = YEAR_GROUPS.reduce((sum, group) => sum + (Number(actual[group]) || 0), 0);
    YEAR_GROUPS.forEach((group) => {
      const value = total > 0 ? ((Number(actual[group]) || 0) / total) * 100 : 0;
      averagePercent[group] += value;
    });
  });

  return YEAR_GROUPS.map((group) => {
    const percentage = Number((averagePercent[group] / denominator).toFixed(2));
    const slot = Math.round((Number(totalCapacity || 0) * percentage) / 100);
    return {
      yearGroup: group,
      percentage,
      slot
    };
  });
}

function normalizeQuotaMap(quotaConfig) {
  const normalizedEntries = calculateSlots(quotaConfig);
  const quotaMap = {
    year1: { percentage: 0, slot: 0 },
    year2: { percentage: 0, slot: 0 },
    year3: { percentage: 0, slot: 0 },
    year4_plus: { percentage: 0, slot: 0 }
  };

  normalizedEntries.forEach((quota) => {
    if (!YEAR_GROUPS.includes(quota.yearGroup)) return;
    quotaMap[quota.yearGroup] = {
      percentage: Number(quota.percentage) || 0,
      slot: Number(quota.slot) || 0
    };
  });

  return quotaMap;
}

function comparisonStatus(diff) {
  if (diff > 0) return 'over_quota';
  if (diff < 0) return 'under_quota';
  return 'on_target';
}

function compareQuotaWithActual(quotaConfig, studentCountsByYearGroup) {
  const quotaMap = normalizeQuotaMap(quotaConfig);
  const actualMap = {
    ...getDefaultCounts(),
    ...(studentCountsByYearGroup || {})
  };

  const comparison = {};
  YEAR_GROUPS.forEach((group) => {
    const quotaSlot = quotaMap[group].slot;
    const actual = Number(actualMap[group]) || 0;
    const diff = actual - quotaSlot;
    const usedPercentage = quotaSlot > 0
      ? Number(((actual / quotaSlot) * 100).toFixed(2))
      : null;

    comparison[group] = {
      quotaSlot,
      actual,
      diff,
      usedPercentage,
      status: comparisonStatus(diff)
    };
  });

  return comparison;
}

async function buildQuotaRealDataComparison(academicYear, quotaConfigInput = null, extraMatch = {}) {
  const quotaConfig = quotaConfigInput || await QuotaConfig.findOne({
    academicYear,
    isDraft: false
  })
    .sort({ version: -1 })
    .lean();

  if (!quotaConfig) {
    throw new Error(`No published quota config found for academic year ${academicYear}`);
  }

  const { counts, pipeline } = await aggregateStudentsByYearGroup(academicYear, extraMatch);
  const comparison = compareQuotaWithActual(quotaConfig, counts);

  return {
    academicYear,
    quotaConfigId: quotaConfig._id,
    version: quotaConfig.version,
    totalCapacity: quotaConfig.totalCapacity,
    actualCounts: counts,
    comparison,
    aggregationPipeline: pipeline
  };
}

module.exports = {
  deriveYearGroup,
  aggregateStudentsByYearGroup,
  compareQuotaWithActual,
  buildQuotaRealDataComparison,
  buildMultiYearQuotaTrend,
  recommendQuotaFromTrends
};