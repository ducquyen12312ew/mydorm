const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { requireQuotaAdmin } = require('../src/middleware/requireQuotaAdmin');
const quotaController = require('../src/controllers/admin/quota-admin-controller');
const QuotaConfig = require('../src/schemas/QuotaConfigSchema');
const QuotaAuditLog = require('../src/schemas/QuotaAuditLogSchema');

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    redirectedTo: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
    send(data) {
      this.payload = data;
      return this;
    },
    redirect(path) {
      this.redirectedTo = path;
      return this;
    }
  };
}

test('RBAC: admin2 cannot modify quota', async () => {
  let nextCalled = false;
  const req = {
    path: '/admin/quotas',
    session: {
      userId: 'u-admin2',
      role: 'admin',
      username: 'admin2'
    }
  };
  const res = createMockRes();

  await requireQuotaAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload, 'Only admin1 can modify quota data');
});

test('RBAC: admin1 can modify quota', async () => {
  let nextCalled = false;
  const req = {
    path: '/admin/quotas',
    session: {
      userId: 'u-admin1',
      role: 'admin',
      username: 'admin1'
    }
  };
  const res = createMockRes();

  await requireQuotaAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('Reason-required: update quota must reject missing reason', async () => {
  const originalFindById = QuotaConfig.findById;

  QuotaConfig.findById = async () => ({
    isDraft: true
  });

  const req = {
    params: { id: 'quota-1' },
    body: {
      academicYear: '2025-2026',
      totalCapacity: 1200,
      year1_percentage: 25,
      year1_slot: 300,
      year2_percentage: 25,
      year2_slot: 300,
      year3_percentage: 25,
      year3_slot: 300,
      year4_plus_percentage: 25,
      year4_plus_slot: 300
    },
    session: { userId: 'u-admin1' }
  };
  const res = createMockRes();

  try {
    await quotaController.updateQuota(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.success, false);
    assert.match(res.payload.error, /Reason is required/i);
  } finally {
    QuotaConfig.findById = originalFindById;
  }
});

after(async () => {
  try {
    await mongoose.disconnect();
  } catch (error) {
    // Ignore teardown errors in test shutdown.
  }
});

test('Publish versioning: publishing draft creates next version document', async () => {
  const originalFindById = QuotaConfig.findById;
  const originalFindOne = QuotaConfig.findOne;
  const originalCreate = QuotaConfig.create;
  const originalAuditCreate = QuotaAuditLog.create;

  const sourceDraft = {
    _id: 'quota-draft-1',
    academicYear: '2025-2026',
    totalCapacity: 1200,
    quotas: [
      { yearGroup: 'year1', percentage: 50, slot: 600 },
      { yearGroup: 'year2', percentage: 20, slot: 240 },
      { yearGroup: 'year3', percentage: 20, slot: 240 },
      { yearGroup: 'year4_plus', percentage: 10, slot: 120 }
    ],
    effectiveFrom: new Date('2025-08-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-07-31T23:59:59.999Z'),
    isDraft: true,
    version: 4
  };

  let createdPayload = null;

  QuotaConfig.findById = () => ({
    lean: async () => sourceDraft
  });

  QuotaConfig.findOne = () => ({
    sort: () => ({
      select: () => ({
        lean: async () => ({ version: 4 })
      })
    })
  });

  QuotaConfig.create = async (payload) => {
    createdPayload = payload;
    return {
      _id: 'quota-published-5',
      ...payload
    };
  };

  QuotaAuditLog.create = async () => ({ _id: 'audit-1' });

  const req = {
    params: { id: 'quota-draft-1' },
    session: { userId: 'u-admin1' }
  };
  const res = createMockRes();

  try {
    await quotaController.publishQuota(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(createdPayload.version, 5);
    assert.equal(createdPayload.isDraft, false);
    assert.equal(createdPayload.academicYear, '2025-2026');
    assert.equal(createdPayload.totalCapacity, 1200);
  } finally {
    QuotaConfig.findById = originalFindById;
    QuotaConfig.findOne = originalFindOne;
    QuotaConfig.create = originalCreate;
    QuotaAuditLog.create = originalAuditCreate;
  }
});
