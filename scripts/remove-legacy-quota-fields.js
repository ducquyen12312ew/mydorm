#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
require('../src/config/config');

const AllocationPolicy = require('../src/schemas/AllocationPolicySchema');
const AllocationCycle = require('../src/schemas/AllocationCycleSchema');
const CohortShift = require('../src/schemas/CohortShiftSchema');
const AllocationAuditLog = require('../src/schemas/AllocationAuditLogSchema');

async function waitForMongoReady() {
  if (mongoose.connection.readyState === 1) return;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for MongoDB connection'));
    }, 20000);

    mongoose.connection.once('connected', () => {
      clearTimeout(timeout);
      resolve();
    });

    mongoose.connection.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function migrateAllocationPolicies() {
  const result = await AllocationPolicy.updateMany(
    {},
    {
      $unset: {
        distribution: '',
        quotas: '',
        totalRooms: '',
        year1_pct: '',
        year2_pct: '',
        year3_pct: '',
        year4_plus_pct: ''
      }
    }
  );

  return {
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0
  };
}

async function migrateAllocationCycles() {
  const result = await AllocationCycle.updateMany(
    {},
    {
      $unset: {
        quotaSnapshot: '',
        'stats.byYearGroup.year1.quota': '',
        'stats.byYearGroup.year2.quota': '',
        'stats.byYearGroup.year3.quota': '',
        'stats.byYearGroup.year2_3.quota': '',
        'stats.byYearGroup.year4_plus.quota': '',
        'stats.byYearGroup.reserved.quota': ''
      }
    }
  );

  return {
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0
  };
}

async function migrateCohortShifts() {
  const docs = await CohortShift.find({});
  let modified = 0;

  for (const doc of docs) {
    let changed = false;

    if (doc.policyId !== undefined) {
      doc.policyId = undefined;
      changed = true;
    }

    if (doc.totalRooms !== undefined) {
      doc.totalRooms = undefined;
      changed = true;
    }

    if (Array.isArray(doc.cohorts)) {
      doc.cohorts.forEach((cohort) => {
        if (cohort.quota !== undefined) {
          cohort.quota = undefined;
          changed = true;
        }
        if (cohort.percentage !== undefined) {
          cohort.percentage = undefined;
          changed = true;
        }
      });
    }

    if (doc.summary) {
      ['year1', 'year2', 'year3', 'year4_plus'].forEach((key) => {
        if (!doc.summary[key]) return;
        if (doc.summary[key].quota !== undefined) {
          doc.summary[key].quota = undefined;
          changed = true;
        }
        if (doc.summary[key].percentage !== undefined) {
          doc.summary[key].percentage = undefined;
          changed = true;
        }
      });
    }

    if (changed) {
      await doc.save();
      modified += 1;
    }
  }

  return {
    scanned: docs.length,
    modified
  };
}

async function migrateAllocationAuditLogs() {
  const unsetResult = await AllocationAuditLog.updateMany(
    {},
    {
      $unset: {
        'before.quotaUsage': '',
        'after.quotaUsage': ''
      }
    }
  );

  const actionTypeResult = await AllocationAuditLog.updateMany(
    { actionType: 'QUOTA_VIOLATION_DETECTED' },
    { $set: { actionType: 'POLICY_UPDATED' } }
  );

  return {
    unsetMatched: unsetResult.matchedCount || 0,
    unsetModified: unsetResult.modifiedCount || 0,
    actionTypeUpdated: actionTypeResult.modifiedCount || 0
  };
}

async function run() {
  console.log('[migration] remove legacy quota fields');
  await waitForMongoReady();

  const [policyStats, cycleStats, cohortStats, auditStats] = await Promise.all([
    migrateAllocationPolicies(),
    migrateAllocationCycles(),
    migrateCohortShifts(),
    migrateAllocationAuditLogs()
  ]);

  console.log('[done] AllocationPolicy', policyStats);
  console.log('[done] AllocationCycle', cycleStats);
  console.log('[done] CohortShift', cohortStats);
  console.log('[done] AllocationAuditLog', auditStats);
}

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[failed]', error.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
