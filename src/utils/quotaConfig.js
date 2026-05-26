function calculateSlots(quotaConfig) {
  const totalCapacity = Number(quotaConfig?.totalCapacity || 0);
  const quotas = Array.isArray(quotaConfig?.quotas) ? quotaConfig.quotas : [];

  return quotas.map((quota) => {
    const percentage = Number(quota?.percentage || 0);
    const calculatedSlot = Math.round((totalCapacity * percentage) / 100);

    return {
      yearGroup: quota.yearGroup,
      percentage,
      slot: calculatedSlot
    };
  });
}

function validateQuota(quotaConfig) {
  const errors = [];
  const quotas = Array.isArray(quotaConfig?.quotas) ? quotaConfig.quotas : [];
  const totalCapacity = Number(quotaConfig?.totalCapacity || 0);

  if (!Number.isFinite(totalCapacity) || totalCapacity <= 0) {
    errors.push('totalCapacity must be a positive number');
  }

  if (quotas.length === 0) {
    errors.push('quotas must contain at least one year group');
  }

  const allowedYearGroups = new Set(['year1', 'year2', 'year3', 'year4_plus']);
  const seenGroups = new Set();

  let percentageSum = 0;
  quotas.forEach((quota, index) => {
    const entryPath = `quotas[${index}]`;
    const yearGroup = quota?.yearGroup;
    const percentage = Number(quota?.percentage);

    if (!allowedYearGroups.has(yearGroup)) {
      errors.push(`${entryPath}.yearGroup is invalid`);
    }

    if (seenGroups.has(yearGroup)) {
      errors.push(`${entryPath}.yearGroup is duplicated`);
    }
    seenGroups.add(yearGroup);

    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      errors.push(`${entryPath}.percentage must be a number between 0 and 100`);
    } else {
      percentageSum += percentage;
    }
  });

  if (Math.abs(percentageSum - 100) > 0.0001) {
    errors.push(`Total percentage must equal 100 (current: ${percentageSum})`);
  }

  if (quotaConfig?.effectiveFrom && quotaConfig?.effectiveTo) {
    const effectiveFrom = new Date(quotaConfig.effectiveFrom);
    const effectiveTo = new Date(quotaConfig.effectiveTo);

    if (effectiveTo <= effectiveFrom) {
      errors.push('Ngày hiệu lực đến phải sau ngày hiệu lực từ');
    }
  }

  const overcapPolicy = quotaConfig?.overcapPolicy || {};
  if (overcapPolicy.enabled) {
    const maxOverPercent = Number(overcapPolicy.maxOverPercent);
    if (!Number.isFinite(maxOverPercent) || maxOverPercent < 0 || maxOverPercent > 100) {
      errors.push('overcapPolicy.maxOverPercent must be a number between 0 and 100');
    }

    const byGroup = overcapPolicy.byYearGroup || {};
    ['year1', 'year2', 'year3', 'year4_plus'].forEach((group) => {
      if (byGroup[group] === null || byGroup[group] === undefined || byGroup[group] === '') {
        return;
      }

      const value = Number(byGroup[group]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        errors.push(`overcapPolicy.byYearGroup.${group} must be a number between 0 and 100`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

const EXAMPLE_QUOTA_DOCUMENT = {
  academicYear: '2025-2026',
  totalCapacity: 1200,
  quotas: [
    { yearGroup: 'year1', percentage: 40, slot: 480 },
    { yearGroup: 'year2', percentage: 25, slot: 300 },
    { yearGroup: 'year3', percentage: 20, slot: 240 },
    { yearGroup: 'year4_plus', percentage: 15, slot: 180 }
  ],
  overcapPolicy: {
    enabled: true,
    maxOverPercent: 2,
    byYearGroup: {
      year1: 1,
      year2: 2,
      year3: 2,
      year4_plus: 3
    }
  },
  analyticsOptions: {
    excludeInternationalStudents: true,
    recommendationWindowYears: 3
  },
  effectiveFrom: new Date('2025-08-01T00:00:00.000Z'),
  effectiveTo: new Date('2026-07-31T23:59:59.999Z'),
  version: 1,
  isDraft: true
};

module.exports = {
  calculateSlots,
  validateQuota,
  EXAMPLE_QUOTA_DOCUMENT
};
