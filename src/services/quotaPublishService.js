const QuotaConfig = require('../schemas/QuotaConfigSchema');
const AllocationPolicyModel = require('../schemas/AllocationPolicySchema');
const { logger } = require('../config/logger');

/**
 * Publishes a quota draft and auto-creates/updates the corresponding AllocationPolicy.
 *
 * Strategy: MongoDB's unique index ({academicYear, isDraft:false}) allows only one
 * non-draft per year. Instead of creating a new document we either:
 *   a) Update the existing non-draft for that year in-place (if one exists), OR
 *   b) Mark the draft itself as isDraft:false (if no non-draft exists for the year).
 * Either way we end up with exactly one non-draft per year and mark it isPublished:true.
 *
 * @param {string} quotaId  _id of the draft quota to publish
 * @param {string} publishedBy  userId performing the action
 * @returns {{ quota, policy }}
 */
async function publishQuotaAndCreatePolicy(quotaId, publishedBy) {
    const now = new Date();

    // 1. Load and validate the draft
    const draft = await QuotaConfig.findById(quotaId).lean();
    if (!draft) throw new Error('Quota not found');
    if (!draft.isDraft) throw new Error('Only draft quota can be published');

    // 2. Archive all currently published quotas (globally — only one active at a time)
    await QuotaConfig.updateMany({ isPublished: true }, { $set: { isPublished: false } });

    // 3. Determine the target document to mark as published
    //    There can only be one isDraft:false per academic year (unique index).
    const existingPublished = await QuotaConfig.findOne({
        academicYear: draft.academicYear,
        isDraft: false
    });

    let published;
    if (existingPublished) {
        // Update the existing non-draft in-place with this draft's content
        existingPublished.totalCapacity = draft.totalCapacity;
        existingPublished.quotas = draft.quotas;
        existingPublished.overcapPolicy = draft.overcapPolicy;
        existingPublished.analyticsOptions = draft.analyticsOptions;
        existingPublished.effectiveFrom = draft.effectiveFrom;
        existingPublished.effectiveTo = draft.effectiveTo;
        existingPublished.isPublished = true;
        existingPublished.publishedAt = now;
        existingPublished.publishedBy = publishedBy;
        existingPublished.version = (existingPublished.version || 1) + 1;
        published = await existingPublished.save();
        logger.info('quotaPublishService: updated existing non-draft to published', {
            quotaId: published._id,
            academicYear: published.academicYear,
            version: published.version
        });
    } else {
        // No non-draft for this year — promote the draft itself
        const updated = await QuotaConfig.findByIdAndUpdate(
            draft._id,
            {
                $set: {
                    isDraft: false,
                    isPublished: true,
                    publishedAt: now,
                    publishedBy
                }
            },
            { new: true }
        );
        published = updated;
        logger.info('quotaPublishService: promoted draft to published', {
            quotaId: published._id,
            academicYear: published.academicYear
        });
    }

    // 4. Upsert AllocationPolicy from this quota's data
    //    findOneAndUpdate bypasses the pre-save hook that blocks two active policies.
    const policy = await AllocationPolicyModel.findOneAndUpdate(
        { academicYear: published.academicYear },
        {
            $set: {
                active: true,
                sourceQuotaId: published._id,
                publishedAt: now,
                publishedBy,
                updatedBy: publishedBy,
                updatedAt: now,
                effectiveFrom: published.effectiveFrom,
                effectiveTo: published.effectiveTo,
                notes: `Auto-generated from Quota ${published.academicYear} v${published.version}`
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Deactivate all other policies
    await AllocationPolicyModel.updateMany(
        { _id: { $ne: policy._id }, active: true },
        { $set: { active: false } }
    );

    logger.info('quotaPublishService: AllocationPolicy upserted', {
        policyId: policy._id,
        academicYear: policy.academicYear
    });

    return { quota: published, policy };
}

/**
 * Returns the currently published quota and its active AllocationPolicy.
 */
async function getPublishedQuotaAndPolicy() {
    const quota = await QuotaConfig.findOne({ isPublished: true })
        .populate('publishedBy', 'name username')
        .lean();

    if (!quota) return { quota: null, policy: null };

    const policy = await AllocationPolicyModel.findOne({ active: true })
        .populate('publishedBy', 'name username')
        .lean();

    return { quota, policy };
}

module.exports = { publishQuotaAndCreatePolicy, getPublishedQuotaAndPolicy };
