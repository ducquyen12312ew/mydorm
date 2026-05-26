# Quota System — Reference

> Consolidates: `docs/quota-detailed-report.md` + `docs/quota-admin-usage-and-testing.md`

---

## What is a Quota?

Quota is an **admin-controlled upper bound** on dormitory spots per year-group for a specific academic year. It is a policy decision, not a real-time headcount.

- Quota is **separate from actual occupancy**.
- Controls are split into two layers:
  - `percentage` — planning layer, must sum to 100%.
  - `slot` — execution layer, can be manually adjusted without touching percentages.
- Default slot formula: `slot_i = round(percentage_i × totalCapacity / 100)`

**Year groups:** `year1`, `year2`, `year3`, `year4_plus`  
**UI labels:** Năm 1, Năm 2, Năm 3, Năm 4 và các năm còn lại

---

## Lifecycle: Draft → Publish → Finalize

```
CREATE draft ──→ EDIT / PLAN ──→ PREVIEW (simulation, no DB write)
                                       │
                                       ▼
                               PUBLISH (creates new versioned document, old versions kept)
                                       │
                                       ▼
                               DASHBOARD (compare quota vs. real counts)
                                       │
                                       ▼
                               FINALIZE (generate slot/eviction plan, write result)
```

- Publishing is **additive**: each publish increments version (`n+1`), previous versions are not deleted.
- Editing a published quota is locked at the UI level. Access via direct URL shows a locked form.

---

## Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| `admin1` | Create, update, publish, finalize |
| `admin2`, `admin3` | View-only |

Enforced by: `src/middleware/requireQuotaAdmin.js`

---

## Routes

| Path | Method | Description |
|------|--------|-------------|
| `/admin/quotas` | GET | List all quotas |
| `/admin/quotas/create` | GET/POST | Create draft |
| `/admin/quotas/:id/edit` | GET/PUT | Edit draft (locked if published) |
| `/admin/quotas/:id/dashboard` | GET | Real vs. quota comparison |
| `/admin/quotas/:id/preview` | GET/POST | Simulation (no DB mutation) |
| `/admin/quotas/audit` | GET | Audit history |
| `/admin/quotas/:id/publish` | POST | Publish current draft |
| `/admin/quotas/:id/finalize` | POST | Execute final slot plan |
| `/admin/quotas/:id/workflow/*` | POST | Notification workflow |

---

## Key Business Rules

1. `PUT /admin/quotas/:id` requires a `reason` field — returns HTTP 400 otherwise.
2. Preview endpoint (`POST /admin/quotas/:id/preview`) does **not** mutate the database.
3. Preview response shape: `{ summary, byYearGroup, removalList }`.
4. Finalize accepts `actualNewApplications` and optional `availableCapacity`.
5. Audit history records: `CREATE`, `UPDATE` (with reason), `PUBLISH`, `FINALIZE`.
6. Audit log `UPDATE` rows always contain the `reason` field.

---

## Dashboard Columns (Real Data View)

`yearGroup` | `quotaPercentage` | `quotaSlot` | `actual` | `usedPercentage` | `status` | `remaining`

Status values: `over_target` | `on_target` | `under_target`

---

## Files

```
src/
  controllers/admin/quota-admin-controller.js   ← render* handlers
  routes/admin/admin-quota-routes.js            ← all /admin/quotas/* routes
  services/quotaPolicyService.js                ← quota logic + dashboard + preview
  schemas/QuotaConfigSchema.js (or similar)     ← data model
  middleware/requireQuotaAdmin.js               ← RBAC guard

views/admin/quotas/
  index.ejs          ← list with action visibility logic
  form.ejs           ← create/edit (locked if published)
  dashboard.ejs      ← real data comparison
  preview.ejs        ← simulation
  workflow.ejs       ← notification workflow
  audit-history.ejs  ← audit log viewer

tests/
  quota-admin-api.test.js   ← RBAC + reason-required + publish versioning
```

---

## Running Tests

```powershell
npm run test:quota-api
```

Requires Node 18+ (built-in `node --test` runner). Server does not need to be running.

**Test coverage:**
- RBAC deny for `admin2` / `admin3` on mutating endpoints
- RBAC allow for `admin1`
- `reason` required on update (returns 400 if missing)
- Publish creates new version document (version increments)

---

## Troubleshooting

- Cannot mutate quota → check session username is `admin1`
- `npm run test:quota-api` fails → ensure Node 18+ is installed
- Published quota showing Edit → clear browser cache (UI hides edit button client-side)
