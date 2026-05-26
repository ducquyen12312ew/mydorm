# Quota Admin Usage and Testing Guide

## 1. Scope
This guide covers the new quota admin workflow:
- Planning (create/edit draft)
- Dashboard (real data comparison)
- Preview (simulation)
- Publish versioning
- Finalize flow
- Audit history
- RBAC for `admin1/admin2/admin3`

## 2. Access Rules (RBAC)
- `admin1`: can create, update, publish, finalize
- `admin2`, `admin3`: view-only for quota pages

Enforced middleware:
- `src/middleware/requireQuotaAdmin.js`

## 3. Main Pages
- Quota list: `/admin/quotas`
- Create draft: `/admin/quotas/create`
- Edit draft: `/admin/quotas/:id/edit`
- Dashboard: `/admin/quotas/:id/dashboard`
- Preview: `/admin/quotas/:id/preview`
- Audit history: `/admin/quotas/audit`

## 4. API/Actions
- Create: `POST /admin/quotas`
- Update draft: `PUT /admin/quotas/:id`
- Publish: `POST /admin/quotas/:id/publish`
- Preview simulation: `POST /admin/quotas/:id/preview`
- Finalize execution planning: `POST /admin/quotas/:id/finalize`

## 5. Manual Test Checklist

### 5.1 Planning / Draft
1. Login with `admin1`.
2. Open `/admin/quotas/create`.
3. Fill `academicYear`, `totalCapacity`, quota % and manual slot values.
4. Submit draft.
5. Confirm new draft row appears in list.

Expected:
- Draft created successfully.
- Manual slot is stored as entered.

### 5.2 Reason-required on Update
1. Open a draft edit page.
2. Try update without `reason`.

Expected:
- API returns 400 with message: `Reason is required for quota update`.

### 5.3 Publish Versioning
1. With a draft selected, click `Publish`.
2. Publish again from another draft of same academic year.

Expected:
- New published document is created each time.
- Version increments (`n+1`) and old versions remain.

### 5.4 Preview (No DB mutation)
1. Open `/admin/quotas/:id/preview`.
2. Trigger preview API.

Expected:
- Response contains `summary`, `byYearGroup`, `removalList`.
- No quota document content is mutated.

### 5.5 Dashboard (Real Data)
1. Open `/admin/quotas/:id/dashboard`.
2. Verify table columns:
   - yearGroup
   - quotaPercentage
   - quotaSlot
   - actual
   - usedPercentage
   - status
   - remaining

Expected:
- Real counts are shown with over/under/on_target status.

### 5.6 Finalize
1. From dashboard, enter `actualNewApplications` and optional `availableCapacity`.
2. Click `Finalize`.

Expected:
- Response includes final slot/eviction adjustment result.
- Finalize action appears in audit history.

### 5.7 Audit History
1. Open `/admin/quotas/audit`.
2. Filter by academic year and by quota version.

Expected:
- Audit logs displayed for `CREATE`, `UPDATE`, `PUBLISH`, `FINALIZE`.
- `UPDATE` rows contain required reason.

### 5.8 RBAC
1. Login as `admin2` or `admin3`.
2. Try:
   - `/admin/quotas` (view)
   - `/admin/quotas/create` (should block)
   - update/publish/finalize endpoints (should block)

Expected:
- View pages allowed.
- Mutating endpoints blocked with 403.

### 5.9 UX Locking
1. Open published quota entry from list.

Expected:
- No Planning/Edit button shown in list for published quota.
- Edit form for published quota is locked if accessed directly.

## 6. Automated Tests

Run:

```powershell
Set-Location D:\GITHUB\Dormitory_Graduation
npm run test:quota-api
```

Current automated coverage (`tests/quota-admin-api.test.js`):
- RBAC deny for non-manager admin (`admin2`)
- RBAC allow for manager admin (`admin1`)
- Reason-required validation on update
- Publish versioning creates next version document

## 7. Troubleshooting
- If `npm run test:quota-api` cannot run, ensure Node version supports built-in test runner (`node --test`, Node 18+).
- If server startup appears inconsistent, verify terminal working directory before running scripts.
- If you cannot mutate quota as admin, check username in session is `admin1`.
