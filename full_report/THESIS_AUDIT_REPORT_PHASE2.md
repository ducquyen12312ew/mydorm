# THESIS AUDIT REPORT — PHASE 2
**Ngày:** 2026-05-31  
**Góc nhìn:** Giảng viên chấm ĐATN CNTT  
**Phạm vi:** Chuyên sâu Ch2, Ch3, Ch4 + AI-smell toàn file  
**Trạng thái:** CHỈ AUDIT — không sửa file

---

## 1. AUDIT CHUYÊN SÂU CHƯƠNG 2

### 1.1 Mục 2.1.1 — Khảo sát người dùng

**Đánh giá tổng thể: 🔴 CRITICAL — Thiếu tính khoa học nghiêm trọng**

**Vấn đề cốt lõi: Không có phương pháp khảo sát**

Phần khảo sát hiện tại viết:
> "Trong quá trình thực hiện đồ án, tác giả đã tiến hành khảo sát và trao đổi trực tiếp với các đối tượng liên quan..."

Một khảo sát học thuật phải có đủ 5 thành phần:

| Thành phần | Yêu cầu | Hiện trạng |
|-----------|---------|-----------|
| Phương pháp | Phỏng vấn / Bảng hỏi / Quan sát | ❌ Không nêu |
| Quy mô mẫu | X sinh viên, Y cán bộ | ❌ Không có số liệu |
| Thời gian | Khi nào thực hiện | ❌ Không có |
| Kết quả định lượng | "60% phản ánh...", "8/10 người..." | ❌ Hoàn toàn thiếu |
| Phân tích | Kết luận từ dữ liệu | ❌ Là suy luận, không phải phân tích |

**Ba "nhóm vấn đề" được trình bày là suy luận, không phải dữ liệu:**
- "sinh viên không hiểu rõ cách điểm ưu tiên được tính toán" — bao nhiêu sinh viên? Bao nhiêu phần trăm?
- "quy trình hiện tại thiếu phản hồi tức thì" — đây là quan sát, không phải kết quả khảo sát
- "thiếu công cụ mô phỏng" — đây là phân tích kỹ thuật, không phải phản hồi từ người dùng

**Kết luận về tính học thuật:** Phần này hiện đang viết như một bài *quan sát cá nhân*, không phải *khảo sát*. Nếu giảng viên hỏi "em làm khảo sát bao nhiêu người, bằng phương pháp gì, kết quả cụ thể thế nào?" — không thể trả lời được từ báo cáo hiện tại.

**Đề xuất:** Một trong hai lựa chọn:
1. **Thực hiện khảo sát thật** (Google Form, 20–30 người) và báo cáo số liệu cụ thể
2. **Đổi tên thành "Phân tích thực trạng"** và viết lại như một bài phân tích vấn đề dựa trên quan sát, không dùng từ "khảo sát"

---

### 1.2 Mục 2.1.2 — Xu hướng phát triển các hệ thống

**Đánh giá tổng thể: 🟠 MAJOR — Không có tài liệu tham khảo**

Hướng dẫn ĐATN nêu rõ:
> "sinh viên nên chỉ rõ nguồn kiến thức mình thu thập được ở tài liệu nào, đồng thời đưa tài liệu đó vào trong danh sách tài liệu tham khảo rồi tạo các tham chiếu chéo"

**Kiểm tra toàn bộ file v2.tex:** Không có một lệnh `\cite{}` nào. Không có `\bibliography{}`. Không có section Tài liệu tham khảo. 

Cụ thể trong phần xu hướng:
- "Xu hướng số hóa... đang được áp dụng ngày càng phổ biến" — tuyên bố không nguồn
- "Nhiều hệ thống tích hợp ứng dụng di động" — hệ thống nào? Nguồn nào?
- "Nền tảng Scape là một ví dụ điển hình" — không có link, không có năm công bố
- "ghép cặp ổn định hoặc quy hoạch tuyến tính" — không cite bài báo gốc (Gale-Shapley 1962?)

**Đây là vấn đề học thuật căn bản nhất của toàn bộ báo cáo.** Một ĐATN CNTT không có tài liệu tham khảo là không đạt yêu cầu tối thiểu.

**Tính AI-generated trong phần xu hướng:** Năm xu hướng được trình bày theo cấu trúc đồng đều, ngôn ngữ trơn tru, không có ví dụ cụ thể, không có con số thực tế. Đây là dấu hiệu rõ của nội dung AI-generated hoặc paraphrase chung chung.

**Đề xuất:**
- Thêm ít nhất 5–8 tài liệu tham khảo (bài báo, whitepaper, hoặc tài liệu chính thức)
- Mỗi xu hướng phải dẫn được 1–2 nguồn cụ thể
- Có thể cite: tài liệu từ EDUCAUSE, jisc.ac.uk, hoặc báo cáo của các trường đại học lớn

---

### 1.3 Mục 2.1.3 — So sánh các giải pháp

**Đánh giá: 🟠 MAJOR — Bảng so sánh có vấn đề về tính khoa học**

Vấn đề 1: **"Hệ thống tích hợp (Engine + UI)" là chính đề tài tự đề xuất**

Đặt hệ thống của mình vào bảng so sánh ở Chương 2 — trong khi hệ thống chưa được triển khai và đánh giá — là **không đúng thứ tự logic**. Đây là bảng so sánh các *giải pháp hiện có*, không phải nơi quảng bá giải pháp mới.

Vấn đề 2: **Không có tên hệ thống cụ thể**

"Phần mềm quản lý KTX thương mại" — là phần mềm nào? StarRez? Roommate? iRent? Không có tên cụ thể thì không thể kiểm chứng.

"Giải pháp nghiên cứu (matching/ILP)" — matching của ai? ILP từ bài báo nào?

**Đề xuất:** Tách bảng so sánh thành 2 phần:
1. So sánh các hệ thống/giải pháp hiện có (với tên cụ thể + citation)
2. Nhận xét về khoảng trống → dẫn dắt sang đề xuất giải pháp của đề tài

---

### 1.4 Thiếu: Tài liệu tham khảo toàn bộ báo cáo

**Đánh giá: 🔴 CRITICAL**

Toàn bộ `v2.tex` (1204 dòng) không có một lệnh `\cite{}` nào. Điều này có nghĩa là:
- Không thể trace nguồn của bất kỳ tuyên bố kỹ thuật nào
- Vi phạm quy định ĐATN về tham chiếu chéo
- Khi giảng viên hỏi "em đọc gì để viết phần này?" — không có câu trả lời nào trong báo cáo

**Tài liệu tối thiểu cần cite cho từng chương:**

| Chương | Nội dung cần cite | Tài liệu gợi ý |
|--------|------------------|----------------|
| Ch1/Ch2 | Bài toán phân bổ phòng | Gale & Shapley 1962; bài báo về stable matching |
| Ch2 | Xu hướng số hóa GDĐH | Báo cáo EDUCAUSE, jisc.ac.uk |
| Ch3 | MVC pattern | Martin Fowler "Patterns of EAA" |
| Ch3 | JWT, RBAC | RFC 7519 (JWT), NIST RBAC standard |
| Ch3 | React Native, Expo | Official documentation with version |
| Ch3 | MongoDB | MongoDB documentation |

---

## 2. AUDIT CHUYÊN SÂU CHƯƠNG 3

> **Lưu ý:** Chương 3 trong file hiện tại (CÔNG NGHỆ VÀ KIẾN TRÚC) thực chất là chương mô tả **công nghệ và yêu cầu hệ thống**, không phải chương triển khai. Use cases và yêu cầu nằm ở **Chương 2** (dòng 697–825). Audit dưới đây phân tích các phần đó theo vị trí thực tế.

### 2.1 Use Cases — Thiếu tính học thuật

**Đánh giá: 🟠 MAJOR**

**Use cases hiện tại thiếu 4 thành phần bắt buộc của khuôn mẫu UC chuẩn:**

| Thành phần UC chuẩn | Hiện trạng |
|--------------------|-----------|
| Actor | ✅ Có (ngầm hiểu) |
| Tiền điều kiện | ✅ Có |
| Hậu điều kiện | ✅ Có |
| Main flow (step-by-step) | ❌ Không có — chỉ có mô tả văn xuôi |
| Alternative flows (số hóa) | ❌ Không có — chỉ đề cập ngắn |
| Exception flows | ❌ Không có |
| Business rules | ❌ Không có |

**So sánh UC3 hiện tại với UC chuẩn:**

Hiện tại chỉ viết (dòng 725):
> "Cán bộ chọn chế độ mô phỏng (preview) để Allocation Engine thực thi... Khi đã hài lòng với một kịch bản, cán bộ xác nhận chuyển sang chế độ thực thi (commit)..."

Một UC chuẩn cần có luồng chính step-by-step:
```
1. Cán bộ chọn [Chạy mô phỏng] từ menu phiên phân bổ
2. Hệ thống xác nhận dữ liệu ứng viên đã đủ điều kiện
3. Cán bộ chọn cấu hình chính sách và xác nhận bắt đầu
4. Allocation Engine thực thi tính điểm ưu tiên cho từng ứng viên
5. Hệ thống hiển thị báo cáo mô phỏng: tỷ lệ lấp đầy, danh sách xung đột
6. [A1] Nếu cán bộ không hài lòng → quay lại bước 3 với tham số khác
7. Cán bộ chọn [Commit] để thực thi chính thức
8. Hệ thống cập nhật trạng thái phòng và ghi audit log
9. Thông báo được gửi đến sinh viên có kết quả
```

**Use cases bị bỏ sót:**

So sánh với source code (các schema tồn tại trong database):

| Schema trong source | UC tương ứng | Hiện trạng |
|--------------------|-------------|-----------|
| MaintenanceRequestSchema | UC về Báo cáo sự cố phòng | ❌ Thiếu UC |
| ViolationSchema | UC về Ghi nhận vi phạm | ❌ Thiếu UC |
| MobileRefreshTokenSchema | UC về Xác thực/Đăng nhập Mobile | ❌ Thiếu UC |
| DomainEventOutboxSchema | UC về Domain Event (outbox pattern) | ❌ Thiếu UC |
| AcademicYear management | UC về Quản lý năm học | ❌ Thiếu UC |
| PriorityClaimSchema | UC về Phúc thẩm điểm ưu tiên | ❌ Thiếu UC |

**UC5 (Quản lý phòng) quá đơn giản:**
Chỉ mô tả CRUD cơ bản nhưng bỏ sót: upload ảnh phòng, cập nhật sơ đồ tầng, quản lý amenities — những tính năng này TỒN TẠI trong source code.

---

### 2.2 Yêu cầu phi chức năng — Số liệu chưa được giải trình

**Đánh giá: 🟠 MAJOR**

**Số liệu không có căn cứ:**

| Yêu cầu | Giá trị | Vấn đề |
|---------|---------|--------|
| Đọc đồng thời | 5.000 req/s | Lấy từ đâu? HUST có bao nhiêu SV? |
| Độ trễ P95 | < 300 ms | Benchmark được thực hiện chưa? |
| Ghi đồng thời | 200 req/s | Cơ sở tính toán? |
| Availability | 99.9% | Là SLA của MongoDB Atlas, không phải yêu cầu hệ thống |
| Test coverage | 80% | Đã đạt chưa? (Ch5 không tồn tại để xác nhận) |

**Chuẩn mực học thuật:** Yêu cầu phi chức năng phải có *cơ sở tính toán* hoặc *benchmark đã thực hiện*. Ví dụ: "HUST có ~40.000 sinh viên, 15% đăng ký KTX, đăng ký tập trung trong 3 ngày → peak load ≈ X req/s → yêu cầu tối thiểu 5.000 req/s."

---

### 2.3 Thiếu: Sequence Diagrams và Activity Diagrams

**Đánh giá: 🟠 MAJOR**

Báo cáo hoàn toàn không có:
- Sequence Diagram cho bất kỳ luồng nào (login, allocation cycle, notification)
- Activity Diagram (Chương 1 dòng 453 cam kết có "thiết kế chi tiết Allocation Engine bao gồm thuật toán và cấu trúc dữ liệu" nhưng không tồn tại)
- Class Diagram
- State Machine Diagram (cho allocation cycle state: DRAFT → PREVIEW → COMMITTED)
- ER Diagram / Data Model

Đây là những artifact bắt buộc trong ĐATN CNTT. Không thể mô tả thiết kế hệ thống chỉ qua văn xuôi.

---

### 2.4 Allocation Engine — Mô tả quá mờ nhạt

**Đánh giá: 🔴 CRITICAL**

Allocation Engine là **đóng góp kỹ thuật cốt lõi** của đề tài (được nhắc đến ở trang đầu trong tên đề tài). Tuy nhiên trong toàn bộ 1204 dòng, không có một đoạn nào mô tả:

- Thuật toán cụ thể: scoring function là gì? (f(weight, criteria) = ?)
- Cách tính `priority_score`: trọng số nào được cộng/nhân với nhau?
- Thứ tự xử lý: greedy? sorted? batch?
- Cách xử lý ràng buộc cứng (hard constraint) vs mềm (soft constraint)
- Độ phức tạp: O(n log n)? O(n²)?
- Preview vs Commit: sự khác biệt kỹ thuật ở tầng gì?

Chỉ có mô tả chức năng mờ nhạt:
> "Allocation Engine tiếp nhận đầu vào là danh sách ứng viên... tính toán điểm ưu tiên theo các tiêu chí đã thiết lập..." (dòng 414–416)

**Đây sẽ là câu hỏi đầu tiên trong buổi bảo vệ.**

---

## 3. AUDIT CHUYÊN SÂU CHƯƠNG 4

### 3.1 Tên chương không khớp nội dung

**Đánh giá: 🔴 CRITICAL**

Tên chương: **"Thiết kế, TRIỂN KHAI VÀ ĐÁNH GIÁ hệ thống"**

| Phần | Cam kết | Thực tế |
|------|---------|---------|
| Thiết kế | ✅ Có (MVC + packages) | ✅ |
| Triển khai | Chi tiết implementation | ❌ Không có |
| Đánh giá | Evaluation results | ❌ Không có |

Nội dung hiện tại của Chương 4 chỉ đủ để đặt tên là "Thiết kế kiến trúc phần mềm", không phải "Thiết kế, Triển khai và Đánh giá".

---

### 3.2 Phân tích kiến trúc — Chất lượng

**Điểm tốt:**
- Mô tả MVC + Service Layer rõ ràng
- Package diagram có hình kèm bảng tóm tắt
- 3 nguyên tắc phụ thuộc được trình bày tốt
- Mô tả luồng request (Ch4, dòng 1053–1062) cụ thể

**Điểm yếu — Giống documentation, không phải báo cáo ĐATN:**

Đoạn (dòng 842, Chapter 3):
> "...tính nhất quán dữ liệu khi thực hiện các toán tử phân bổ theo chu kỳ (allocation cycle), tính mở rộng cho chính sách kế thừa (policy inheritance), và khả năng tự động hóa các kịch bản xử lý vi phạm (violation workflow)..."

Ba thuật ngữ kỹ thuật (allocation cycle, policy inheritance, violation workflow) được dùng như thể người đọc đã biết chúng là gì. Không có định nghĩa, không có giải thích.

**Thiếu: Luận chứng cho các lựa chọn kiến trúc**

Một báo cáo ĐATN chất lượng phải trả lời:
- Tại sao MVC mà không phải Hexagonal Architecture hoặc Clean Architecture?
- Tại sao MongoDB (NoSQL) mà không phải PostgreSQL? Allocation Engine có cần ACID transaction không?
- Tại sao EJS (SSR) mà không phải React/Next.js? Điểm yếu của EJS là gì?
- Tại sao Redis cho Socket.IO adapter mà không phải RabbitMQ/Kafka cho event-driven?

Hiện tại chỉ có:
> "Việc chọn MongoDB Atlas là phù hợp do mô hình dữ liệu có tính biến đổi..." (dòng 871)

Một câu giải thích ngắn, không có so sánh với phương án thay thế.

---

### 3.3 Nội dung giống documentation hơn ĐATN

**Đoạn nhiều "documentation flavor" nhất (dòng 856–869):**

> "Hệ thống tích hợp Winston làm thư viện logging... output dạng JSON, ghi lại toàn bộ hành động... Sentry (@sentry/node) được khởi tạo ngay từ đầu... Về bảo mật lớp trung gian, hệ thống sử dụng Helmet... express-rate-limit... express-mongo-sanitize..."

Đây là mô tả *danh sách thư viện đang dùng* — không có phân tích, không có lý do kỹ thuật, không có so sánh. Đây là READme, không phải ĐATN.

**Đoạn giống giáo trình nhất (dòng 1022–1028):**

> "Mô hình MVC phân tách ứng dụng thành ba tầng độc lập với trách nhiệm riêng biệt: Model chịu trách nhiệm quản lý dữ liệu... View đảm nhận việc hiển thị thông tin... Controller tiếp nhận yêu cầu..."

Định nghĩa MVC này có thể copy từ bất kỳ textbook nào. Người đọc ĐATN không cần được dạy MVC là gì — họ cần biết đề tài áp dụng MVC như thế nào và tại sao.

---

## 4. AUDIT AI-SMELL

### 4.1 Các cụm được yêu cầu kiểm tra

| Cụm | Số lần | Dòng | Nhận xét |
|-----|--------|------|---------|
| `Hiện nay` | 1 | 309 | "Thực trạng hiện nay tại ĐHBK..." |
| `hiện nay` | 0 | — | Không thêm lần nào |
| `Ngày nay` / `ngày nay` | 0 | — | Không xuất hiện |
| `Có thể thấy rằng` | 0 | — | Không xuất hiện |
| `Nhìn chung` | 0 | — | Không xuất hiện |
| `Từ đó cho thấy` | 0 | — | Không xuất hiện |
| `Có thể nhận thấy` | 1 | 546 | "có thể nhận thấy một số xu hướng..." |

Các cụm cụ thể này ở mức chấp nhận được (1–2 lần). Không phải vấn đề chính.

### 4.2 AI-smell thực sự — Các pattern ẩn

**Pattern 1: "đồng thời" xuất hiện quá nhiều**

| Dòng | Cụm |
|------|-----|
| 290 | "giải quyết đồng thời ba nhóm vấn đề" |
| 300 | "mỗi quyết định gán phòng phải đồng thời thoả mãn" |
| 361 | "thay thế hoàn toàn... đồng thời cung cấp" |
| 366 | "hỗ trợ hai chế độ... đồng thời tự động sinh" |
| 576 | "nhiều sinh viên cần được thông báo đồng thời" |
| 621 | "đáp ứng đồng thời toàn bộ yêu cầu" |
| 785 | "xử lý được tối thiểu 5.000 yêu cầu đọc đồng thời" |
| 788 | "hỗ trợ ít nhất 200 yêu cầu đồng thời" |

Tổng: **8+ lần** — "đồng thời" đang dùng như từ đệm mặc định.

**Pattern 2: Cấu trúc "không chỉ... mà còn"**

| Dòng | Cụm |
|------|-----|
| 271 | "không chỉ hoạt động dạy và học mà còn cả các quy trình hành chính" |
| 314 | "không chỉ tiêu tốn nhiều công sức... mà còn tiềm ẩn nhiều rủi ro" |
| 1199 | "không chỉ đảm bảo tính nhất quán... mà còn tạo điều kiện" |

Tổng: 3 lần — pattern điển hình AI dùng để tạo câu phức.

**Pattern 3: "ngày càng" lặp lại**

Dòng 283, 284, 337, 565 — 4+ lần. Mỗi lần đứng trong câu khác nhau nhưng đều là filler.

**Pattern 4: Meta-commentary AI-typical (nói về chính văn bản)**

Dòng 660:
> "Dưới đây là phần phân tích ngắn gọn cho từng nhóm chức năng, mỗi đoạn mô tả các chức năng con chính sau khi phân rã."

Câu này không cung cấp thông tin — nó chỉ *mô tả cái sắp viết*. Đây là dấu hiệu rõ nhất của AI-generated text.

Dòng 647:
> "Về mặt phương pháp, đây là bước nền để chuyển từ mô tả yêu cầu tổng thể sang đặc tả chức năng có thể kiểm chứng."

Câu này nghe như AI đang tự giải thích logic của mình, không phải sinh viên phân tích hệ thống.

**Pattern 5: Liệt kê tính chất dạng triplet**

- "tính công bằng... tính minh bạch... tính kịp thời... tính linh hoạt" (dòng 279–281)
- "tính nhất quán dữ liệu... tính mở rộng... khả năng tự động hóa" (dòng 842–845)
- "allocation, policy change, violation handling" (dòng 857)

Pattern 3-4 thành phần song song liên tiếp là cấu trúc AI ưa dùng để "lấp đầy" nội dung.

**Pattern 6: Kết đoạn bằng generalization vô nghĩa**

Dòng 683:
> "nhằm hỗ trợ phân tích kết quả và ra quyết định chính sách."

Dòng 688 (cuối đoạn quy trình nghiệp vụ):
> "Chu trình này thể hiện rõ mối liên hệ nhân quả giữa các khối chức năng..."

Dòng 1193–1194:
> "Mức độ coupling thấp giữa các tầng cũng tạo điều kiện để kiểm thử từng module độc lập và mở rộng hệ thống mà không làm phức tạp thêm các phần đã ổn định."

Các câu kết này nghe hay nhưng không cung cấp thông tin mới — là padding.

### 4.3 Đánh giá mức độ AI-generated

**Phân loại theo chương:**

| Phần | Mức AI-smell | Nhận xét |
|------|-------------|---------|
| Ch1 — Đặt vấn đề | 🟡 Trung bình | Nội dung tốt nhưng triplet patterns |
| Ch2 — Tổng quan 2 đoạn | 🟡 Trung bình | Câu văn trơn tru quá |
| Ch2 — Xu hướng 5 xu hướng | 🔴 Cao | Cấu trúc đồng đều, không có góc nhìn cá nhân |
| Ch2 — Biểu đồ phân rã (7 đoạn) | 🔴 Cao | Rõ ràng là bullet list AI viết thành prose |
| Ch3 — Các section công nghệ | 🟠 Khá cao | Liệt kê tính năng, thiếu phân tích |
| Ch4 — MVC definition | 🔴 Cao | Copy definition từ textbook |
| Ch4 — Package description | 🟡 Trung bình | Phân tích tốt hơn |

---

## 5. GÓC NHÌN GIẢNG VIÊN — 10 CÂU HỎI CÓ KHẢ NĂNG BỊ HỎI CAO NHẤT

### 5.1 Câu hỏi sẽ được hỏi ĐẦU TIÊN (chắc chắn):

**❓ "Em khảo sát bao nhiêu người? Dùng phương pháp gì? Kết quả cụ thể thế nào?"**

*Báo cáo hiện tại không thể trả lời được câu này.*

---

**❓ "Tài liệu tham khảo của em đâu? Em đọc gì để làm đề tài này?"**

*Toàn bộ báo cáo không có một citation nào — đây là lỗi cơ bản nhất.*

---

### 5.2 Câu hỏi về kỹ thuật cốt lõi (dễ bị bắt bẻ nhất):

**❓ "Allocation Engine tính điểm ưu tiên theo công thức gì? Em có thể viết ra không?"**

*Báo cáo chỉ nói "tính toán điểm ưu tiên theo các tiêu chí đã thiết lập" — không có công thức cụ thể.*

---

**❓ "Tại sao em chọn MongoDB mà không phải PostgreSQL? Allocation Engine có cần ACID transaction không?"**

*Giải thích hiện tại chỉ 1 câu: "mô hình dữ liệu có tính biến đổi" — chưa đủ.*

---

**❓ "Em mô phỏng (preview) khác commit ở đâu ở tầng kỹ thuật? Sequence diagram luồng đó như thế nào?"**

*Không có sequence diagram trong toàn bộ báo cáo.*

---

**❓ "Con số 5.000 request đồng thời lấy từ đâu? Em đã test load chưa?"**

*Không có benchmark, không có cơ sở tính toán trong báo cáo.*

---

### 5.3 Câu hỏi về thiết kế (cần chuẩn bị giải trình):

**❓ "Chương 4 tên là Thiết kế, Triển khai và Đánh giá nhưng em chỉ có phần Thiết kế. Triển khai và Đánh giá đâu?"**

*Câu hỏi không tránh được với cấu trúc hiện tại.*

---

**❓ "Policy inheritance hoạt động như thế nào? Có ví dụ cụ thể không?"**

*Thuật ngữ xuất hiện ở dòng 848 nhưng không được định nghĩa hay giải thích.*

---

**❓ "Tại sao dùng EJS thay vì React hay Next.js? EJS có điểm gì mạnh hơn với bài toán này?"**

*Giải thích hiện tại quá ngắn và generic.*

---

**❓ "Bố cục đồ án ở Chương 1 mô tả Chương 2 là về lý thuyết phân bổ và thuật toán. Nhưng Chương 2 thực tế là use cases và requirements. Em giải thích thế nào?"**

*Đây là mâu thuẫn rõ ràng trong báo cáo.*

---

## 6. TÓM TẮT THEO MỨC ĐỘ

### 🔴 CRITICAL

| ID | Vị trí | Mô tả |
|----|--------|-------|
| P2-C1 | Toàn bộ file | Không có `\cite{}` / tài liệu tham khảo |
| P2-C2 | Ch2, dòng 516–541 | Khảo sát thiếu methodology, sample size, số liệu |
| P2-C3 | Ch4, tiêu đề | Tên chương "Triển khai + Đánh giá" không có nội dung tương ứng |
| P2-C4 | Toàn bộ | Allocation Engine không được mô tả thuật toán cụ thể |

### 🟠 MAJOR

| ID | Vị trí | Mô tả |
|----|--------|-------|
| P2-M1 | Ch2, 2.1.2 | Xu hướng công nghệ không có nguồn tham khảo |
| P2-M2 | Ch2, 2.1.3 | Bảng so sánh không có tên hệ thống cụ thể |
| P2-M3 | Ch2, UC1–UC6 | Use cases thiếu numbered main flow, alternative flows |
| P2-M4 | Ch2, dòng 785 | NFR numbers không có cơ sở tính toán |
| P2-M5 | Toàn bộ | Không có Sequence Diagram, Activity Diagram, State Machine |
| P2-M6 | Ch3, dòng 842 | Dùng thuật ngữ kỹ thuật chưa định nghĩa |
| P2-M7 | Ch4, dòng 1022 | Định nghĩa MVC như giáo trình, không phân tích ứng dụng |

### 🟡 MINOR

| ID | Vị trí | Mô tả |
|----|--------|-------|
| P2-m1 | Toàn file | "đồng thời" xuất hiện 8+ lần như từ đệm |
| P2-m2 | Dòng 660 | Meta-commentary AI-typical |
| P2-m3 | Ch2, 2.1.3 | "Hệ thống tích hợp" trong bảng so sánh là hệ thống của chính tác giả |
| P2-m4 | Ch3, dòng 856 | Liệt kê thư viện như README, thiếu phân tích lý do chọn |
| P2-m5 | Ch2, UC bị thiếu | MaintenanceRequest, Violation, AcademicYear chưa có UC |

---

## 7. ƯỚC TÍNH TÁC ĐỘNG NẾU KHÔNG SỬA

| Lỗi | Tác động khi bảo vệ |
|-----|---------------------|
| Thiếu tài liệu tham khảo | Yêu cầu bổ sung trước khi chấp nhận |
| Khảo sát thiếu methodology | Câu hỏi đầu tiên, không trả lời được |
| Allocation Engine không rõ | Câu hỏi trọng tâm, ảnh hưởng điểm kỹ thuật |
| Ch4 thiếu Triển khai + Đánh giá | Đặt câu hỏi về sự hoàn chỉnh của đồ án |
| Không có Sequence Diagram | Yếu kém về thiết kế kỹ thuật |
| Bố cục không khớp nội dung | Mâu thuẫn nội tại, thiếu nhất quán |

---

*Phase 2 audit hoàn thành. Chờ xác nhận trước khi tiến hành sửa.*
