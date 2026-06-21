const express = require('express');
const router = express.Router();

const quotaAdminController = require('../../controllers/admin/quota-admin-controller');
const {
  requireQuotaViewer,
  requireQuotaAdmin
} = require('../../middleware/requireQuotaAdmin');
const { DormitoryCollection } = require('../../config/config');

router.get('/admin/quotas', requireQuotaViewer, quotaAdminController.renderQuotaList);
router.get('/admin/quotas/leadership/dashboard', requireQuotaViewer, quotaAdminController.renderLeadershipDashboard);
router.get('/admin/quotas/audit', requireQuotaViewer, quotaAdminController.renderAuditHistory);
router.get('/admin/quotas/create', requireQuotaAdmin, quotaAdminController.renderCreateForm);
router.post('/admin/quotas', requireQuotaAdmin, quotaAdminController.createQuota);
router.get('/admin/quotas/:id/edit', requireQuotaViewer, quotaAdminController.renderEditForm);
router.get('/admin/quotas/:id/workflow', requireQuotaViewer, quotaAdminController.renderWorkflowPage);
router.put('/admin/quotas/:id', requireQuotaAdmin, quotaAdminController.updateQuota);
router.post('/admin/quotas/:id/publish', requireQuotaAdmin, quotaAdminController.publishQuota);
router.post('/admin/quotas/:id/preview', requireQuotaViewer, quotaAdminController.previewQuota);
router.post('/admin/quotas/:id/finalize', requireQuotaAdmin, quotaAdminController.finalizeQuotaPlan);
router.post('/admin/quotas/:id/workflow/regenerate', requireQuotaAdmin, quotaAdminController.regenerateWorkflowPlan);
router.post('/admin/quotas/:id/notifications/plan', requireQuotaAdmin, quotaAdminController.createNotificationBatch);
router.post('/admin/quotas/:id/notifications/:batchId/send', requireQuotaAdmin, quotaAdminController.sendNotificationBatch);
router.get('/admin/quotas/:id/preview', requireQuotaViewer, quotaAdminController.renderPreviewPage);
router.get('/admin/quotas/:id/dashboard', requireQuotaViewer, quotaAdminController.renderDashboardPage);

// GET: Compute current capacity from dormitory data
router.get('/api/admin/capacity/current', requireQuotaViewer, async (req, res) => {
  try {
    const dorms = await DormitoryCollection.find({ isDeleted: { $ne: true } }).lean();
    let totalBeds = 0, totalRooms = 0;
    for (const d of dorms) {
      for (const floor of (d.floors || [])) {
        for (const room of (floor.rooms || [])) {
          totalRooms++;
          totalBeds += room.maxCapacity || 0;
        }
      }
    }
    res.json({ success: true, totalBeds, totalRooms, dormCount: dorms.length });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// DELETE: Delete a quota (not allowed if published/active)
router.delete('/admin/quotas/:id', requireQuotaAdmin, quotaAdminController.deleteQuota);

// POST: Archive a published quota
router.post('/admin/quotas/:id/archive', requireQuotaAdmin, quotaAdminController.archiveQuota);

// POST: Reactivate an archived quota
router.post('/admin/quotas/:id/reactivate', requireQuotaAdmin, quotaAdminController.reactivateQuota);

module.exports = router;
