const express = require('express');
const router = express.Router();

const quotaAdminController = require('../../controllers/admin/quota-admin-controller');
const {
  requireQuotaViewer,
  requireQuotaAdmin
} = require('../../middleware/requireQuotaAdmin');

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

module.exports = router;
