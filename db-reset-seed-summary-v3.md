# DB Reset & Seed — Final Dataset v3

**Date:** 2026-06-11  
**Branch:** demo1  
**Mục tiêu:** Sửa 4 lỗi sau khi seed v2: Actual=0%, eviction vô lý, phòng giả (cohort gom theo tòa), tòa full 100%.

---

## Tóm tắt kết quả

| Chỉ số | Kết quả | Mục tiêu |
|---|---|---|
| Tổng sinh viên | **1450** | 1450 ✅ |
| Allocated | **1430** | 1430 ✅ |
| Pending | **20** | 20 ✅ |
| Occupancy | **82.1%** | 82.1% ✅ |
| Duplicate studentId | **0** | 0 ✅ |
| Duplicate email | **0** | 0 ✅ |
| Duplicate phone | **0** | 0 ✅ |
| Validation checks | **11/11 PASS** | — ✅ |

---

## Bugs được fix trong v3

### Lỗi 1: Quota Dashboard — Actual = 0% toàn bộ

**Root cause:** `quotaComparisonService.js` có list các giá trị "VN nhận" để lọc sinh viên quốc tế:
```javascript
$nin: [null, '', 'VN', 'Viet Nam', 'Vietnam', 'viet nam', 'vietnam']
```
Seed script dùng `nationality: 'Việt Nam'` (có dấu) — **không nằm trong list** → tất cả sinh viên bị coi là quốc tế → bị loại khỏi aggregation → Actual = 0 cho mọi year group.

**Fix 1 — Service:** Thêm `'Việt Nam'`, `'việt nam'`, `'VIỆT NAM'`, `'Viet nam'` vào list VN_VALUES trong `quotaComparisonService.js`:
```javascript
const VN_VALUES = [null, '', 'VN', 'Viet Nam', 'Vietnam', 'viet nam', 'vietnam',
                   'Việt Nam', 'việt nam', 'VIỆT NAM', 'Viet nam'];
```

**Fix 2 — Seed:** Đổi `nationality: 'Việt Nam'` → `nationality: 'VN'` để nhất quán với whitelist.

**File:** `src/services/quotaComparisonService.js` dòng 90-109

---

### Lỗi 2: Eviction Simulation — "Year2: 148 cần rời KTX" khi còn 312 giường trống

**Root cause:** QuotaConfig cũ là `2026-2027` với `totalCapacity=1200`. Service tính:
- Quota year1 slot = X (dựa trên 1200), year2 slot = Y
- Actual year2 = 392 nhưng slot = (27% × 1200) = 324 → overflow = 68
- academicYearStart = 2026 → yearInSchool = 2026 - enrollmentYear + 1 → sinh viên 2025 được tính là year2 chứ không phải year1 → Actual year1 = 0

**Fix:** Tạo QuotaConfig `2025-2026` với:
- `totalCapacity = 1742` (bằng physical beds)
- Slots đặt **cao hơn** actual để overflow = 0 cho mọi year group

| Year Group | Slot (quota) | Actual | Trạng thái |
|---|---|---|---|
| year1 | 644 | 508 | under quota — OK |
| year2 | 470 | 392 | under quota — OK |
| year3 | 383 | 319 | under quota — OK |
| year4+ | 245 | 231 | under quota — OK |

Kết quả: `overflow = 0` → `eviction = 0` → dashboard hiển thị hợp lý.

---

### Lỗi 3: Room Assignment — Sinh viên cùng năm gom vào 1 tòa

**Root cause:** Script điền phòng theo thứ tự: year1 trước, year2 sau → tòa đầu tiên full year1, tòa tiếp theo full year2.

**Fix:** Shuffle students bằng Fisher-Yates trước khi fill, sau đó fill theo round-robin across dorms.

**Thuật toán mới:**
1. `Fisher-Yates shuffle(assignedStudents)` → trộn ngẫu nhiên
2. Group rooms by dormId
3. Tạo `interleavedRooms[]`: lấy 1 phòng từ mỗi tòa, round-robin
4. Fill rooms theo thứ tự interleaved

**Kết quả mỗi tòa (sau fix):**

| Tòa | Capacity | Occupied | Free | Year1 | Year2 | Year3 | Year4+ |
|---|---|---|---|---|---|---|---|
| KTX A1 | 58 | 43 | 15 | 16 (37%) | 10 | 14 | 3 |
| KTX B2 | 28 | 13 | 15 | 5 (38%) | 6 | 2 | 0 |
| KTX C3 | 260 | 226 | 34 | 75 (33%) | 61 | 49 | 41 |
| KTX D4 | 312 | 271 | 41 | 105 (39%) | 72 | 55 | 39 |
| KTX E5 | 480 | 353 | 127 | 127 (36%) | 96 | 68 | 62 |
| KTX F6 | 364 | 316 | 48 | 105 (33%) | 95 | 71 | 45 |
| KTX G7 | 240 | 208 | 32 | 65 (31%) | 47 | 57 | 39 |

Mỗi tòa có Year1 trong khoảng **31–39%** — phân bố tự nhiên, không gom cohort.

---

### Lỗi 4: Tòa KTX bị fill 100%

**Root cause:** Script fill rooms cho đến khi hết 1430 sinh viên, không giới hạn per-dorm → tòa đầu tiên có thể bị fill hoàn toàn.

**Fix:** Thêm per-dorm cap = `min(87% capacity, capacity - 15)`. Mỗi tòa luôn còn ít nhất **15 giường trống**.

Kết quả:
- Tòa nhỏ nhất (B2/28 giường): 15 giường trống (54% free)
- Tòa lớn nhất (E5/480 giường): 127 giường trống (26% free)
- Tất cả 7 tòa đều có free beds cho demo đăng ký

---

## Files thay đổi

| File | Action | Nội dung |
|---|---|---|
| `src/services/quotaComparisonService.js` | MODIFIED | Thêm 'Việt Nam' vào VN_VALUES list |
| `scripts/reset-all-allocation-data.js` | MODIFIED | Xóa ALL quotaconfigs (không chỉ draft) |
| `scripts/seed-production-realistic.js` | MODIFIED | nationality='VN', shuffle, round-robin, per-dorm cap, tạo QuotaConfig 2025-2026 |
| `db-reset-seed-summary-v3.md` | CREATED | File này |

---

## Cấu trúc dataset sau seed

### Students

```
Total Students:   1450
Allocated:        1430  (có phòng, RoomAllocation ACTIVE)
Unallocated:      20    (không có phòng, AllocationRegistration)
```

### Year Distribution

```
year1  (enrollmentYear=2025): 508 (35.0%)
year2  (enrollmentYear=2024): 392 (27.0%)
year3  (enrollmentYear=2023): 319 (22.0%)
year4+ (enrollmentYear=2022/2021): 231 (15.9%)
```

### Occupancy

```
Total Beds:       1742
Occupied Beds:    1430
Available Beds:   312
Occupancy %:      82.1%
```

### Registrations

```
PENDING:    12  (simulation có thể chạy)
WAITLIST:   5
REJECTED:   3
```

### Quota Config (2025-2026)

```
totalCapacity: 1742
year1:    37% = 644 slots  (actual 508 → under quota)
year2:    27% = 470 slots  (actual 392 → under quota)
year3:    22% = 383 slots  (actual 319 → under quota)
year4+:   14% = 245 slots  (actual 231 → under quota)
→ Eviction simulation: Need Leave = 0 cho tất cả year groups
```

---

## Dashboard readiness sau v3

| Dashboard | Trước v3 | Sau v3 |
|---|---|---|
| Quota vs Actual | Actual = 0% tất cả | ✅ Hiển thị đúng: year1=35%, year2=27%... |
| Eviction Simulation | "Year2: 148 cần rời KTX" | ✅ Need Leave = 0 (còn 312 giường trống) |
| Room Distribution | Year1 gom đầy tòa A1+A2 | ✅ Mỗi tòa: Year1=31-39%, mixed |
| Dormitory Availability | 1-2 tòa bị full 100% | ✅ Mỗi tòa còn ít nhất 15 giường |
| Simulation | 12 PENDING registrations | ✅ Unchanged |
| Cohort Shift | Snapshot 2025-2026 | ✅ Unchanged |

---

## Validation — 11/11 PASS

| Check | Kết quả |
|---|---|
| 1430 allocated students trong room occupants | ✅ 1430 verified |
| Room occupants tồn tại trong students | ✅ 1430 verified |
| ACTIVE RoomAllocations = 1430 | ✅ |
| Occupied beds = ACTIVE allocations | ✅ beds=1430, allocs=1430 |
| 20 unassigned không có dormitoryId | ✅ |
| PENDING registrations readable | ✅ 12 PENDING |
| Quota dashboard year distribution readable | ✅ year1=508, year2=392 |
| Duplicate studentId = 0 | ✅ |
| Duplicate email = 0 | ✅ |
| Duplicate phone = 0 | ✅ |
| Enrollment year ↔ yearGroup mapping valid | ✅ 0 invalid |

---

## Cách reset và seed lại

```bash
node scripts/reset-all-allocation-data.js
node scripts/seed-production-realistic.js
```

**Default password tất cả sinh viên:** `Dquyen12@`  
**Login format:** `studentId` làm username (vd: `20250001`, `20240023`)
