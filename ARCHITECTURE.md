# 🏢 Dormitory Allocation System - Architecture Overview

Hệ thống quản lý phân phòng ký túc xá với 3 thành phần chính:

---

## 1️⃣ QUOTA & POLICY (Chính sách chỉ tiêu theo năm học)

### 📍 Vị trí chính
```
src/
  ├─ services/quotaPolicyService.js          ← Logic chia quota + dashboard + override
  ├─ routes/admin/quota-policy-routes.js     ← API quản lý quota
  ├─ schemas/AllocationPolicySchema.js       ← Schema lưu policy
  └─ schemas/AllocationCycleSchema.js        ← Chu kỳ phân phòng

views/admin/quota-policy/                    ← UI quản trị quota
```

### 🎯 Quota là gì?

Quota = tỷ lệ phân bổ giường/phòng theo nhóm năm học trong một năm học cụ thể.

Hệ thống dùng 4 nhóm:
- `year1`
- `year2`
- `year3`
- `year4_plus`

Mỗi nhóm có:
- `percentage`: tỷ lệ phần trăm
- `quota`: số chỗ kế hoạch (tính từ percentage)
- `allocated`: số chỗ thực tế đã cấp

### 🧮 Công thức chia quota

Với `totalRooms` (thực tế đang hiểu như tổng chỗ/giường kế hoạch của policy):

```text
quota(group) = round( percentage(group) / 100 * totalRooms )
```

Code hiện tại dùng `Math.round` cho từng nhóm độc lập.

Lưu ý vận hành:
- Tổng `%` phải `<= 100` (nếu `>100` API sẽ reject).
- Tổng `%` < 100 là hợp lệ, phần còn lại coi như buffer chưa phân bổ.
- Do làm tròn từng nhóm, tổng `quota` có thể lệch 1-2 chỗ so với `totalRooms`.

### ✅ Rule validate khi set quota

Từ route/service hiện tại:
- `academicYear` phải đúng format `YYYY-YYYY`.
- `totalRooms > 0` khi tạo/cập nhật.
- `year1_pct + year2_pct + year3_pct + year4_plus_pct <= 100`.
- Mỗi `%` từng nhóm trong khoảng `0..100`.

### 🔧 Rule khi override realtime

API override: `POST /api/quota-policy/override`

Guardrail bắt buộc:
- Mỗi nhóm chỉ được đổi tối đa `±20%` mỗi lần override.
- Nếu không có thay đổi thật, hệ thống từ chối.
- Mọi thay đổi được ghi `AllocationAuditLog` (ai đổi, lý do, trước/sau).

### 📊 Planned vs Actual

Dashboard tính cho từng nhóm:
- `plannedQuota = quota`
- `actualUsage = allocated`
- `remaining = max(plannedQuota - actualUsage, 0)`
- `overAllocated = max(actualUsage - plannedQuota, 0)`
- `utilization = actualUsage / plannedQuota`

=> Nhìn nhanh nhóm nào thiếu, nhóm nào cấp vượt kế hoạch.

### 📈 Cách đặt tỷ lệ chia quota (khuyến nghị vận hành)

Không set quota theo cảm tính. Nên set theo 3 tầng:

1. Tầng base (cam kết chính sách)
- Ví dụ: `year1=50, year2=25, year3=15, year4+=10`.

2. Tầng tín hiệu dữ liệu năm gần nhất
- Nhu cầu đăng ký theo cohort.
- Tỷ lệ retention/rớt của cohort.
- Tín hiệu admission đầu vào năm mới.

3. Tầng an toàn
- Giữ `2%..8%` buffer (tổng % khoảng `92..98`) để xử lý biến động.
- Chỉ override nhỏ mỗi lần (<= 20%/group) để tránh sốc hệ thống.

### 🧪 Ví dụ set quota cụ thể

Giả sử:
- `totalRooms = 1200`
- Đề xuất set `%`: `year1=48, year2=26, year3=16, year4+=8`
- Tổng = `98%` (chừa 2% buffer)

Tính quota:
- `year1 = round(0.48 * 1200) = 576`
- `year2 = round(0.26 * 1200) = 312`
- `year3 = round(0.16 * 1200) = 192`
- `year4+ = round(0.08 * 1200) = 96`

Tổng quota = `1176`, buffer chưa phân bổ = `24`.

### 🧭 Checklist set quota nhanh cho admin

1. Chốt `totalRooms` theo capacity thực tế.
2. Chọn `%` từng nhóm, đảm bảo tổng `<=100`.
3. Ưu tiên `year1` theo chính sách tuyển mới.
4. Chừa buffer nhỏ cho biến động giữa kỳ.
5. Theo dõi dashboard deviation 3-7 ngày.
6. Nếu lệch mạnh, dùng override có lý do và log audit.

### 📊 API Endpoints
```
GET    /api/quota-policy/list              → Danh sách policy
GET    /api/quota-policy/dashboard         → Dashboard theo năm học
GET    /api/quota-policy/recommendation    → Gợi ý tỷ lệ từ dữ liệu lịch sử
GET    /api/quota-policy/deviation         → Độ lệch kế hoạch/thực tế
GET    /api/quota-policy/override-history  → Lịch sử override
POST   /api/quota-policy/create            → Tạo policy mới
PUT    /api/quota-policy/:id               → Cập nhật policy
POST   /api/quota-policy/:id/activate      → Kích hoạt policy
POST   /api/quota-policy/override          → Override realtime
DELETE /api/quota-policy/:id               → Xoá policy
```

### 📐 Công thức đầy đủ (tóm tắt nhanh)

#### 1) Quota theo nhóm năm

Gọi:
- `C`: tổng chỗ kế hoạch (`totalRooms`)
- `p_i`: phần trăm nhóm `i` (`year1`, `year2`, `year3`, `year4_plus`)

Công thức:
```text
quota_i = round((p_i / 100) * C)
```

Ràng buộc:
```text
0 <= p_i <= 100
Σ p_i <= 100
C > 0
```

Buffer chưa phân bổ:
```text
buffer_pct = 100 - Σ p_i
buffer_slots = C - Σ quota_i
```

#### 2) Dashboard kế hoạch vs thực tế

Với mỗi nhóm `i`:
```text
planned_i     = quota_i
actual_i      = allocated_i
remaining_i   = max(planned_i - actual_i, 0)
over_i        = max(actual_i - planned_i, 0)
utilization_i = (actual_i / planned_i) * 100   (nếu planned_i > 0, ngược lại = 0)
```

Độ lệch:
```text
deviation_rooms_i = actual_i - planned_i
deviation_pct_i   = (deviation_rooms_i / planned_i) * 100   (nếu planned_i > 0)
```

#### 3) Guardrail override realtime

Khi đổi quota từ `before_i` sang `after_i`:
```text
delta_i = after_i - before_i
|delta_i| <= 20 (% điểm) cho mỗi nhóm
```

Nếu mọi `delta_i = 0` thì reject (không có thay đổi thật).

#### 4) Smart ranking score của sinh viên

Chuẩn hoá thành phần:
```text
distance_norm = clamp(round((distance_km / 500) * 100), 0, 100)
financial_norm = map theo mức khó khăn tài chính (0..100)
priority_norm  = map theo mức ưu tiên (0..100)
```

Điểm tổng:
```text
score = 0.35 * distance_norm
  + 0.35 * financial_norm
  + 0.30 * priority_norm
```

Làm tròn hệ thống:
```text
totalScore = round(score, 2 chữ số thập phân)
```

#### 5) Auto-approve trong chu kỳ

Phần trăm auto approve đầu vào `a` được chặn:
```text
autoApprovePercent = clamp(round(a), 50, 60)
```

Số slot auto:
```text
targetAutoCount = floor(totalApplications * autoApprovePercent / 100)
autoSlots = min(targetAutoCount, availableBeds)
```

#### 6) Chia slot công bằng theo nhóm (fairness targets)

Với mỗi nhóm `g`:
```text
proportional_g = (count_g / totalApplications) * autoSlots
base_g         = floor(proportional_g)
target_g       = min(base_g, count_g)
```

Nếu còn slot dư:
- Phân bổ thêm 1 slot theo thứ tự `remainder_g = proportional_g - base_g` từ cao xuống thấp.

#### 7) Chỉ số fairness sau khi chọn

```text
registrationShare_g = registrationCount_g / totalRegistrations
selectedShare_g     = selectedCount_g / totalSelected
deviation_g(%)      = (selectedShare_g - registrationShare_g) * 100
maxDeviation(%)     = max(|deviation_g|)
```

Trạng thái:
```text
maxDeviation <= 10%  => BALANCED
maxDeviation >  10%  => NEEDS_REVIEW
```

#### 8) Gợi ý quota từ lịch sử (recommendation)

Hệ thống tạo forecast demand theo cohort, rồi chuẩn hoá:
```text
forecastPct = normalize_to_100(forecastDemand)
blended_i   = 0.7 * forecastPct_i + 0.3 * manualPct_i
suggestedPct = normalize_to_100(blended)
deltaPct_i  = suggestedPct_i - manualPct_i
```

Trong đó `normalize_to_100` là scale lại để tổng đúng 100 và bù sai số làm tròn vào nhóm có trọng số lớn nhất.

---

## 2️⃣ ALLOCATION ALGORITHM (Thuật toán gợi ý chỉ tiêu & phân phòng tự động)

### 📍 Vị trí chính
```
src/services/
  ├─ allocationService.js                  ← 🔥 **LỎI CHÍNH** - Smart ranking algorithm
  ├─ rebalancingService.js                 ← Cân bằng lại nếu cần
  └─ [other allocation services]

src/routes/
  ├─ allocation-routes.js                  ← REST API
  ├─ allocation-dashboard-routes.js        ← Dashboard data
  └─ admin/admin-allocation-ui-routes.js   ← UI routes

views/admin/
  ├─ allocation/dashboard.ejs              ← Allocation dashboard
  └─ planning/policy-suggestion-dashboard.ejs  ← Policy suggestion
```

### 🎯 Chức năng chính

#### A. Smart Ranking Score (Điểm ưu tiên thông minh)
```javascript
calculateSmartRankingScore(registration) {
  Score = Distance × 0.35        // Quãng đường từ nhà
         + Financial × 0.35       // Khó khăn tài chính
         + Priority × 0.30        // Mức ưu tiên

  // Ví dụ: SV xa nhà 600km, khó khăn tài chính cao, ưu tiên P1
  // Score = (100 × 0.35) + (85 × 0.35) + (80 × 0.30) = 87.75/100
}
```

#### B. Fairness Targets (Phân bổ công bằng theo khóa)
```javascript
buildFairnessTargets(rankedApplications, autoSlots) {
  // Chia slots dựa trên tỷ lệ % đăng ký của từng khóa
  // Ví dụ: Nếu 60 slots, Năm1 = 40%, Năm2 = 35%, Năm3 = 25%
  // → Năm1: 24 slots | Năm2: 21 slots | Năm3: 15 slots
}
```

#### C. Auto-Approval Pipeline (Duyệt tự động)
```
Pending Registrations
    ↓
Rank by Smart Score
    ↓
Select top % (configurable, default 55%)
    ↓
Allocate proportionally by year group
    ↓
Remaining → Manual Review List
```

### 📊 API Endpoints
```
GET  /api/allocation/dashboard/:academicYear        → Live dashboard
GET  /api/allocation/usage-report/:academicYear     → Chi tiết sử dụng
POST /api/allocation/quick-approve                  → Approve danh sách
GET  /api/allocation/recommendations                → Gợi ý tiếp theo
```

### 🧮 Ví dụ thế thực
```
Năm học 2024-2025:
 - Sức chứa: 500 phòng = 500 giường
 - Quota: Năm1=30%, Năm2=25%, Năm3=25%, Năm4+=20%
 - Đăng ký: 600 SV (350 Năm1, 150 Năm2, 100 Năm3)

Phân phòng:
 - Auto-approve 55% = 330 SV
    → Năm1: 198 (56% × 350)
    → Năm2: 83  (56% × 150)
    → Năm3: 49  (56% × 100)
 - Manual review: 270 SV còn lại
```

---

## 3️⃣ DASHBOARD REALTIME & WORKFLOW REVIEW (Theo dõi và xét duyệt)

### 📍 Vị trí chính
```
src/routes/admin/
  ├─ admin-allocation-ui-routes.js         ← UI control flow
  ├─ allocation-dashboard-routes.js        ← Data feeds
  └─ quota-policy-routes.js

views/admin/
  ├─ allocation/
  │   ├─ dashboard.ejs                    ← Live allocation status
  │   ├─ admin-allocation-policies.ejs    ← Policy management
  │   └─ ...
  ├─ planning/
  │   └─ policy-suggestion-dashboard.ejs  ← Policy planning
  └─ quota-policy/
      └─ index.ejs                        ← Quota monitoring
```

### 📊 Major Dashboards

#### Dashboard Phân Phòng (Allocation Dashboard)
```
views/admin/allocation/dashboard.ejs

Hiển thị:
├─ Khả năng chứa (bao nhiêu SV, bao nhiêu phòng)
├─ Tình trạng từng khóa (allocated/pending/waitlist)
├─ Số phòng trống
└─ Nút "Rebalance" nếu cần điều chỉnh
```

#### Dashboard Đề xuất Chính sách (Policy Suggestion)
```
views/admin/planning/policy-suggestion-dashboard.ejs

Hiển thị:
├─ So sánh 5 năm học gần nhất
├─ Xu hướng đăng ký theo khóa
├─ Gợi ý tỷ lệ tối ưu cho năm sau
└─ Dự báo nhu cầu
```

#### Dashboard Quota (Quota Policy)
```
views/admin/quota-policy/index.ejs

Hiển thị:
├─ Các policy hiện tại & active
├─ So sánh dự tính vs thực tế
├─ Lịch sử điều chỉnh
└─ Độ lệch (deviation) từ kế hoạch
```

### 🔄 Workflow Xét duyệt

```
1. ADMIN TẠO POLICY + QUOTA
   → POST /admin/quota-policy/create
   → Lưu vào AllocationPolicySchema

2. TẠO VÒNG PHÂN PHÒNG
   → POST /allocation/cycles
   → Ghi snapshot sức chứa

3. SV ĐĂNG KÝ (self-registration)
   → POST /student/registration
   → AllocationRegistration.status = "PENDING"

4. ADMIN CHẠY AUTO-ALLOCATION
   → GET /api/allocation/dashboard
   → calculateSmartRankingScore cho mỗi SV
   → buildFairnessTargets → allocate proportionally
   → Status: "PENDING" → "ALLOCATED" hoặc "WAITLIST"

5. MANUAL REVIEW (nếu cần)
   → Dashboard hiển thị "Manual Review List"
   → Admin xét từng case, quyết định approve/reject

6. PUBLISH RESULTS
   → Gửi thông báo cho SV đã được chọn
   → Waitlist chờ phòng trống
```

---

## 📈 Quy trình trong thực tế

### Trước năm học:
```
THÁNG 5-6           THÁNG 7
   ↓                   ↓
Phân tích năm trước  → Tạo Policy tỷ lệ mà → Nên set 30% vs 25% cho năm1?
                       học quá khó/dễ        → Hoặc giữ nguyên?
                                            → Check từ recommendation API
                       ↓
                   Tạo Allocation Cycle
                   (Main Registration)
                       ↓
                   SV đăng ký
```

### Trong năm học:
```
SV ĐĂNG KÝ                                   → Pending
  ↓
ADMIN CHẠY AUTO-ALLOCATION                  → Allocated (55%)
  ↓                                          → Waitlist (45%)
MANUAL REVIEW (nếu cần)                     → Reject hoặc Allocate
  ↓
PUBLISH RESULTS
  ↓
SV MOVE INTO DORMS + CHỌN PHÒNG
  ↓
REBALANCE (nếu một số phòng trống)
  ↓
DASHBOARD REALTIME TRACKING SỨC CHỨA
```

---

## 🛠 Technologi Stack

| Tầng | Công nghệ | Vị trí |
|------|-----------|--------|
| **Backend** | Node.js + Express | `src/` |
| **Database** | MongoDB | `src/schemas/*.js` |
| **Services** | AllocationService, QuotaPolicyService | `src/services/` |
| **API** | RESTful JSON | `src/routes/` |
| **Frontend** | EJS Templates + JavaScript | `views/admin/` |
| **Realtime** | AJAX/Fetch polling | `public/js/` |

---

## 📝 Key Files Summary

| File | Mục đích | Dòng chính |
|------|---------|----------|
| `quotaPolicyService.js` | Core quota logic | `getRegistrationCounts()`, `getDashboardData()` |
| `allocationService.js` | Ranking & allocation | `calculateSmartRankingScore()`, `buildFairnessTargets()` |
| `AllocationPolicySchema.js` | DB schema policy | `priorityRules`, `rebalanceThresholds` |
| `AllocationCycleSchema.js` | DB schema cycle | `registrationStart/End`, `capacitySnapshot` |
| `quota-policy-routes.js` | Policy CRUD API | All policy endpoints |
| `allocation-routes.js` | Allocation API | Profile, cycle, recommendation endpoints |
| `dashboard.ejs` | Allocation monitor | Real-time status |
| `policy-suggestion-dashboard.ejs` | Historical analysis | Trend & forecast |

---

## 🚀 Để báo cáo (talking points)

**"Thứ nhất là policy + quota..."**
> File: `src/services/quotaPolicyService.js` + `views/admin/quota-policy/`
> Định nghĩa tỷ lệ cố định cho từng năm học, so sánh dự tính vs thực tế

**"Thứ hai là thuật toán gợi ý..."**
> File: `src/services/allocationService.js`, method `calculateSmartRankingScore()`
> Auto-ranking dựa trên quãng đường + tài chính + ưu tiên, phân bổ công bằng by year group

**"Dashboard realtime, workflow xét duyệt..."**
> File: `views/admin/allocation/dashboard.ejs` + `src/routes/admin/admin-allocation-ui-routes.js`
> Hiển thị live tình trạng, auto-approve 55%, manual review từng trường hợp

**"Quản lý toàn bộ vòng đời..."**
> Từ đăng ký → allocation → phập vào phòng → kiểm tra, tất cả được track trong
> `AllocationRegistration` schema + audit logs

---

**Cập nhập lần cuối:** 27/03/2026
