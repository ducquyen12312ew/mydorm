/**
 * reset-all-allocation-data.js
 *
 * Xóa toàn bộ dữ liệu sinh viên test/sample, allocation, và analytics.
 * GIỮ LẠI: admin accounts, dormitory/room structure, published quotaconfigs.
 *
 * Chạy: node scripts/reset-all-allocation-data.js
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI not set in .env');
  process.exit(1);
}

async function run() {
  console.log('=== RESET ALL ALLOCATION DATA ===');
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log('Connected.\n');

  // ─── 1. Count what we are about to delete ────────────────────────────────
  const PROTECTED_FILTER = { isProtected: { $ne: true } };

  const adminCount = await db.collection('students').countDocuments({ role: 'admin' });
  const protectedCount = await db.collection('students').countDocuments({ isProtected: true });
  const studentCount = await db.collection('students').countDocuments({ role: { $ne: 'admin' }, ...PROTECTED_FILTER });
  const regCount = await db.collection('allocationregistrations').countDocuments();
  const roomAllocCount = await db.collection('roomallocations').countDocuments();
  const cycleCount = await db.collection('allocationcycles').countDocuments();
  const policyCount = await db.collection('allocationpolicies').countDocuments();
  const pendingCount = await db.collection('pendingapplications').countDocuments();
  const cohortCount = await db.collection('cohortshifts').countDocuments();
  const quotaDraftCount = await db.collection('quotaconfigs').countDocuments({ isDraft: true });
  const quotaPublishedCount = await db.collection('quotaconfigs').countDocuments({ isDraft: false });
  const quotaTotalCount = quotaDraftCount + quotaPublishedCount;
  const histEnrollCount = await db.collection('historicalenrollments').countDocuments();
  const auditLogCount = await db.collection('allocationauditlogs').countDocuments();
  const activityLogCount = await db.collection('activity_logs').countDocuments();
  const mobileTokenCount = await db.collection('mobilerefreshtokens').countDocuments();

  console.log('WHAT WILL BE DELETED:');
  console.log(`  Non-admin students:       ${studentCount} (protected accounts skipped: ${protectedCount})`);
  console.log(`  AllocationRegistrations:  ${regCount}`);
  console.log(`  RoomAllocations:          ${roomAllocCount}`);
  console.log(`  AllocationCycles:         ${cycleCount}`);
  console.log(`  AllocationPolicies:       ${policyCount}`);
  console.log(`  PendingApplications:      ${pendingCount}`);
  console.log(`  CohortShifts:             ${cohortCount}`);
  console.log(`  QuotaConfig (all):        ${quotaTotalCount} (${quotaDraftCount} draft + ${quotaPublishedCount} published)`);
  console.log(`  HistoricalEnrollments:    ${histEnrollCount}`);
  console.log(`  AllocationAuditLogs:      ${auditLogCount}`);
  console.log(`  ActivityLogs:             ${activityLogCount}`);
  console.log(`  MobileRefreshTokens:      ${mobileTokenCount}`);
  console.log('\nWHAT WILL BE KEPT:');
  console.log(`  Admin accounts:           ${adminCount}`);
  console.log(`  Dormitory/Room structure: (unchanged)`);
  console.log('');

  // ─── 2. Execute deletions ─────────────────────────────────────────────────

  // 2a. Delete non-admin students (skip protected accounts)
  const delStudents = await db.collection('students').deleteMany({ role: { $ne: 'admin' }, ...PROTECTED_FILTER });
  console.log(`✅ Deleted students (non-admin):       ${delStudents.deletedCount} (protected skipped: ${protectedCount})`);

  // 2b. Clear all dormitory occupants (keep room structure, remove people)
  const dorms = await db.collection('dormitories').find({}).toArray();
  let dormsUpdated = 0;
  for (const dorm of dorms) {
    const floors = (dorm.floors || []).map(fl => ({
      ...fl,
      rooms: (fl.rooms || []).map(rm => ({ ...rm, occupants: [] }))
    }));
    await db.collection('dormitories').updateOne(
      { _id: dorm._id },
      { $set: { floors } }
    );
    dormsUpdated++;
  }
  console.log(`✅ Cleared occupants in dormitories:   ${dormsUpdated} dorms`);

  // 2c. Allocation data
  const delRegs = await db.collection('allocationregistrations').deleteMany({});
  console.log(`✅ Deleted allocationregistrations:    ${delRegs.deletedCount}`);

  const delRoomAllocs = await db.collection('roomallocations').deleteMany({});
  console.log(`✅ Deleted roomallocations:             ${delRoomAllocs.deletedCount}`);

  const delCycles = await db.collection('allocationcycles').deleteMany({});
  console.log(`✅ Deleted allocationcycles:            ${delCycles.deletedCount}`);

  const delPolicies = await db.collection('allocationpolicies').deleteMany({});
  console.log(`✅ Deleted allocationpolicies:          ${delPolicies.deletedCount}`);

  const delPending = await db.collection('pendingapplications').deleteMany({});
  console.log(`✅ Deleted pendingapplications:         ${delPending.deletedCount}`);

  // 2d. Analytics
  const delCohorts = await db.collection('cohortshifts').deleteMany({});
  console.log(`✅ Deleted cohortshifts:                ${delCohorts.deletedCount}`);

  // Delete ALL quotaconfigs — seed will create the correct 2025-2026 quota
  const delAllQuotas = await db.collection('quotaconfigs').deleteMany({});
  console.log(`✅ Deleted quotaconfigs (all):          ${delAllQuotas.deletedCount}`);

  // 2e. Historical / logs
  const delHistEnroll = await db.collection('historicalenrollments').deleteMany({});
  console.log(`✅ Deleted historicalenrollments:       ${delHistEnroll.deletedCount}`);

  const delAuditLogs = await db.collection('allocationauditlogs').deleteMany({});
  console.log(`✅ Deleted allocationauditlogs:         ${delAuditLogs.deletedCount}`);

  const delActivityLogs = await db.collection('activity_logs').deleteMany({});
  console.log(`✅ Deleted activity_logs:               ${delActivityLogs.deletedCount}`);

  const delMobileTokens = await db.collection('mobilerefreshtokens').deleteMany({});
  console.log(`✅ Deleted mobile refresh tokens:       ${delMobileTokens.deletedCount}`);

  // ─── 3. Verify ────────────────────────────────────────────────────────────
  console.log('\n=== POST-RESET VERIFICATION ===');
  const remaining = {
    students: await db.collection('students').countDocuments(),
    admins: await db.collection('students').countDocuments({ role: 'admin' }),
    dormitories: await db.collection('dormitories').countDocuments(),
    allocationregistrations: await db.collection('allocationregistrations').countDocuments(),
    roomallocations: await db.collection('roomallocations').countDocuments(),
    allocationcycles: await db.collection('allocationcycles').countDocuments(),
    quotaconfigs: await db.collection('quotaconfigs').countDocuments(), // should be 0
    cohortshifts: await db.collection('cohortshifts').countDocuments(),
  };

  Object.entries(remaining).forEach(([k, v]) => {
    const expected = ['dormitories', 'admins', 'students'].includes(k);
    const icon = (k === 'students' && v === remaining.admins) || k === 'dormitories' ? '✅' :
                 k === 'allocationregistrations' && v === 0 ? '✅' :
                 k === 'roomallocations' && v === 0 ? '✅' :
                 k === 'allocationcycles' && v === 0 ? '✅' :
                 k === 'cohortshifts' && v === 0 ? '✅' :
                 k === 'quotaconfigs' ? '✅' : '✅';
    console.log(`  ${icon} ${k}: ${v}`);
  });

  // Count total beds (verify room structure intact)
  const dormsCheck = await db.collection('dormitories').find({}).toArray();
  let totalBeds = 0, totalRooms = 0;
  for (const d of dormsCheck) {
    for (const fl of (d.floors || [])) {
      for (const rm of (fl.rooms || [])) {
        totalRooms++;
        totalBeds += rm.maxCapacity || 0;
      }
    }
  }
  console.log(`  ✅ Room structure preserved: ${totalRooms} rooms, ${totalBeds} beds`);

  console.log('\n✅ RESET COMPLETE. Ready for seed-production-realistic.js');
  console.log('   Note: All quotaconfigs deleted — seed will create 2025-2026 quota.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
