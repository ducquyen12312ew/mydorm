# DB Reset & Seed — Final Dataset v2

**Date:** 2026-06-11  
**Branch:** demo1  
**Mục tiêu:** Dataset demo cuối cùng cho ĐATN — 1450 sinh viên, 82.1% occupancy, tất cả validation pass.

---

## Tóm tắt kết quả

| Chỉ số | Kết quả | Mục tiêu |
|---|---|---|
| Tổng sinh viên | **1450** | 1450 ✅ |
| Allocated (có phòng) | **1430** | 1430 ✅ |
| Pending (chưa có phòng) | **20** | 20 ✅ |
| Occupancy | **82.1%** | 82.1% ✅ |
| Duplicate studentId | **0** | 0 ✅ |
| Duplicate email | **0** | 0 ✅ |
| Duplicate phone | **0** | 0 ✅ |
| Validation checks | **11/11 PASS** | — ✅ |

---

## Phase 1 — Reset DB

**Script:** `scripts/reset-all-allocation-data.js`  
**Chạy:** `node scripts/reset-all-allocation-data.js`

### Đã xóa

| Collection | Số lượng |
|---|---|
| students (role=user) | 1715 |
| allocationregistrations | 165 |
| roomallocations | 1550 |
| allocationcycles | 2 |
| allocationpolicies | 1 |
| cohortshifts | 1 |
| Dormitory occupants | cleared (7 dorms) |

### Giữ lại

| | |
|---|---|
| Admin accounts | 4 |
| Dormitories | 7 KTX |
| Rooms | 265 phòng |
| Beds | 1742 giường |
| QuotaConfig (published) | 1 |

---

## Phase 2 — Thiết kế dataset

### Phân bố theo năm học 2025-2026

Logic: `yearInSchool = 2025 - enrollmentYear + 1`

| Enrollment Year | Year Group | Assigned | Unassigned | Total | % |
|---|---|---|---|---|---|
| 2025 | Year 1 | 498 | 10 | 508 | 35.0% |
| 2024 | Year 2 | 387 | 5 | 392 | 27.0% |
| 2023 | Year 3 | 316 | 3 | 319 | 22.0% |
| 2022 | Year 4+ (4th) | 133 | 1 | 134 | 9.2% |
| 2021 | Year 4+ (5th) | 96 | 1 | 97 | 6.7% |
| **TOTAL** | | **1430** | **20** | **1450** | 100% |

### Registration status cho 20 sinh viên pending

| Status | Count |
|---|---|
| PENDING | 12 |
| WAITLIST | 5 |
| REJECTED | 3 |
| **TOTAL** | **20** |

---

## Phase 3 — Script: seed-production-realistic.js

**Script:** `scripts/seed-production-realistic.js`  
**Chạy:** `node scripts/seed-production-realistic.js`

### Kiến trúc script (thay đổi so với v1)

Script v2 dùng **fixed counts** thay vì percentage-based:

```javascript
const ASSIGNED_COUNTS   = { 2025: 498, 2024: 387, 2023: 316, 2022: 133, 2021: 96 };
const UNASSIGNED_COUNTS = { 2025: 10,  2024: 5,   2023: 3,   2022: 1,   2021: 1  };
const REG_STATUS_QUOTA  = { PENDING: 12, WAITLIST: 5, REJECTED: 3 };
```

Script validate tổng trước khi chạy:
- `ASSIGNED_COUNTS` phải = 1430
- `UNASSIGNED_COUNTS` phải = 20  
- `REG_STATUS_QUOTA` phải = 20

### Dữ liệu mỗi sinh viên

| Field | Giá trị |
|---|---|
| studentId | `{enrollmentYear}{seq:4}` — vd: `20250001` |
| email | `{studentId}@sis.hust.edu.vn` — unique |
| phone | `03x/08x/09x + 7 chữ số` — unique, không trùng |
| fullName | Họ + tên đệm + tên, tiếng Việt có dấu |
| gender | 55% nam / 45% nữ |
| dateOfBirth | `enrollmentYear - 18` (tuổi thực tế) |
| faculty | 10 viện/trường HUST thực tế |
| major | Ngành theo faculty |
| className | `IT{yy}{A-H}` |
| gpa | Year1: 7.5–9.0, Year2: 7.8–8.8, Year3: 8.0–9.2, Year4+: 8.2–9.5 |
| password | `Dquyen12@` (bcrypt 10 rounds) |
| role | `user` |
| isActive | `true` |

### Priority data

| Year Group | Distance | Financial Aid | Priority |
|---|---|---|---|
| Year 1 | 50–600km (50% xa) | 15% critical/high | 12% critical/high |
| Year 2 | 40–500km (35% xa) | 8% critical/high | 5% critical/high |
| Year 3+ | 30–400km (20% xa) | thấp hơn | thấp hơn |

### Cách fill phòng

- Fill tuần tự: điền đầy 1 phòng → sang phòng tiếp
- 220/265 phòng được sử dụng, 45 phòng còn trống
- Sinh viên unassigned: KHÔNG có `dormitoryId`, KHÔNG có `roomNumber`

### Allocation data được tạo

| Collection | Count | Chi tiết |
|---|---|---|
| AllocationCycles | 2 | 1 COMPLETED (HK1) + 1 PENDING (HK2) |
| AllocationRegistrations | 20 | PENDING:12, WAITLIST:5, REJECTED:3 |
| RoomAllocations | 1430 | status=ACTIVE |
| CohortShifts | 1 | Snapshot 2025-2026 |
| AllocationPolicies | 1 | 2025-2026 |

---

## Phase 4 — Kết quả sau seed

### Students

```
Total Students:  1450
Allocated:       1430
Unallocated:     20
```

### Occupancy

```
Total Beds:      1742
Occupied Beds:   1430
Available Beds:  312
Occupancy %:     82.1%
```

### Year Distribution

```
year1       :   508 (35.0%)
year2       :   392 (27.0%)
year3       :   319 (22.0%)
year4_plus  :   231 (15.9%)
```

### Registrations

```
PENDING   : 12
WAITLIST  : 5
REJECTED  : 3
```

### Cohort Shift Snapshot

```
year1      : 508 students, 498 allocated
year2      : 392 students, 387 allocated
year3      : 319 students, 316 allocated
year4_plus : 231 students, 229 allocated
```

---

## Phase 5 — Validation (11/11 PASS)

| Check | Kết quả |
|---|---|
| 1430 allocated students có trong room occupants | ✅ 1430 verified |
| Tất cả room occupants tồn tại trong students | ✅ 1430 verified |
| ACTIVE RoomAllocations = 1430 | ✅ found: 1430 |
| Occupied beds = ACTIVE allocations | ✅ beds=1430, allocs=1430 |
| 20 unassigned students không có dormitoryId | ✅ found: 20 |
| PENDING registrations readable by simulation | ✅ 12 PENDING |
| Quota dashboard year distribution readable | ✅ year1=508, year2=392 |
| Duplicate studentId = 0 | ✅ 0 |
| Duplicate email = 0 | ✅ 0 |
| Duplicate phone = 0 | ✅ 0 |
| Enrollment year ↔ yearGroup mapping valid | ✅ 0 invalid |

---

## Dashboard readiness

| Dashboard | Trạng thái |
|---|---|
| Admin dashboard (tổng quan) | ✅ 1450 sinh viên, 82.1% occupancy |
| Quota vs Actual | ✅ Actual sẽ hiển thị year1=35%, phân bố thực tế |
| Cohort Shift | ✅ Snapshot 2025-2026 đầy đủ 4 year group |
| Simulation | ✅ 12 PENDING registrations để chạy simulation |
| Allocation cycle | ✅ Cycle HK2 PENDING, 20 sinh viên chờ |
| Room availability | ✅ 312 giường còn trống cho người dùng thật đăng ký |

**Lý do giữ 312 giường trống (82.1% thay vì 89%):**  
Khi người dùng thật đăng ký tài khoản mới và nộp đơn KTX, hệ thống vẫn còn phòng để phân — tránh phải reset database khi demo.

---

## Files thay đổi

| File | Action | Mô tả |
|---|---|---|
| `scripts/reset-all-allocation-data.js` | EXISTS | Không đổi |
| `scripts/seed-production-realistic.js` | REWRITTEN | Fixed counts, validation tích hợp, thêm major/className/dob/gpa |
| `db-reset-seed-summary-v2.md` | CREATED | File này |

---

## Cách dùng lại

```bash
node scripts/reset-all-allocation-data.js
node scripts/seed-production-realistic.js
```

**Default password tất cả sinh viên:** `Dquyen12@`  
**Login:** dùng `studentId` làm username (vd: `20250001`)

---

## Bug đã fix (so với v1)

| Bug | Mô tả | Fix |
|---|---|---|
| YEAR_DIST key sai | v1 dùng `2026: 0.35` cho year1 nhưng loop chỉ chạy 2025–2021 → chỉ tạo 1007 sinh viên, occupancy 57.8% | Đổi sang fixed counts, key 2025 cho year1 |
| Percentage-based không đảm bảo tổng chính xác | Rounding errors có thể gây tổng ≠ target | Dùng fixed integer counts, validate trước khi chạy |
