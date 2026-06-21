'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 30000 });

async function run() {
  await mongoose.connection.asPromise();
  const db = mongoose.connection.db;

  const quotas = db.collection('quotaconfigs');
  const policies = db.collection('allocationpolicies');

  // Find the quota we need to publish
  const quota = await quotas.findOne({ isPublished: { $ne: true } });
  if (!quota) {
    console.log('No unpublished quota found — checking if already published...');
    const published = await quotas.findOne({ isPublished: true });
    console.log('Published quota:', published ? `${published.academicYear} v${published.version}` : 'NONE');
  } else {
    console.log(`Found unpublished quota: ${quota.academicYear}, isDraft=${quota.isDraft}, isPublished=${quota.isPublished}`);
    const now = new Date();
    await quotas.updateOne(
      { _id: quota._id },
      { $set: { isPublished: true, isDraft: false, publishedAt: now, updatedAt: now } }
    );
    console.log(`✓ Set isPublished=true on QuotaConfig ${quota.academicYear}`);
  }

  // Ensure there's an active AllocationPolicy
  const activePolicy = await policies.findOne({ active: true });
  if (activePolicy) {
    console.log(`Active AllocationPolicy already exists: ${activePolicy.academicYear}`);
  } else {
    // Find any policy and activate it, or create one from the quota
    const anyPolicy = await policies.findOne({});
    if (anyPolicy) {
      await policies.updateOne({ _id: anyPolicy._id }, { $set: { active: true } });
      console.log(`✓ Activated AllocationPolicy ${anyPolicy.academicYear}`);
    } else {
      // Create a minimal AllocationPolicy from the published quota
      const publishedQuota = await quotas.findOne({ isPublished: true });
      if (publishedQuota) {
        const now = new Date();
        await policies.insertOne({
          academicYear: publishedQuota.academicYear,
          active: true,
          sourceQuotaId: publishedQuota._id,
          publishedAt: now,
          effectiveFrom: publishedQuota.effectiveFrom || now,
          effectiveTo: publishedQuota.effectiveTo || new Date(now.getFullYear() + 1, 11, 31),
          notes: `Auto-created from QuotaConfig ${publishedQuota.academicYear}`,
          createdAt: now,
          updatedAt: now
        });
        console.log(`✓ Created AllocationPolicy for ${publishedQuota.academicYear}`);
      }
    }
  }

  // Final state
  const q = await quotas.findOne({ isPublished: true });
  const p = await policies.findOne({ active: true });
  console.log('\nFinal state:');
  console.log('  Published quota:', q ? `${q.academicYear} v${q.version}` : 'NONE');
  console.log('  Active policy: ', p ? `${p.academicYear}` : 'NONE');

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
