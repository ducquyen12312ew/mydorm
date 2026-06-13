# THESIS AUDIT REPORT — v2.tex
**Ngày audit:** 2026-05-31  
**File:** `full_report/v2.tex` (1204 dòng)  
**Trạng thái:** CHỈ ĐỌC — chưa sửa file

---

## TÓM TẮT NHANH

| Chương | Có Tổng quan | Có Kết chương | Liên kết | Định dạng | Điểm |
|--------|-------------|--------------|----------|-----------|------|
| Chương 1 | ⚠️ Thiếu danh mục mục | ✅ Có | ➡️ → Ch2 OK | ✅ | 7/10 |
| Chương 2 | ⚠️ Thiếu danh mục mục | ✅ Có | ← Ch1 OK | ✅ | 6/10 |
| Chương 3 | ❌ KHÔNG CÓ | ✅ Có | ❌ Không liên kết Ch2 | ✅ | 5/10 |
| Chương 4 | ⚠️ Không liên kết Ch3 | ✅ Có | ← Ch3 thiếu | ✅ | 6/10 |

---

## 1. KIỂM TRA PHẦN TỔNG QUAN CHƯƠNG

### Chương 1 — GIỚI THIỆU ĐỀ TÀI (dòng 263–293)
**Đánh giá: ⚠️ MAJOR**

Chương 1 có 3 đoạn mở đầu trước khi vào section đầu tiên. Các đoạn này cung cấp bối cảnh tốt nhưng **không đáp ứng đầy đủ yêu cầu Tổng quan chương**:

- ✅ Giải thích lý do xuất hiện đề tài (bối cảnh CNTT, nhu cầu số hóa)
- ✅ Nêu hướng tiếp cận tổng quát
- ❌ **Không liệt kê các mục sẽ trình bày** (Đặt vấn đề, Mục tiêu, Phạm vi, Định hướng giải pháp, Bố cục)
- ❌ Không có câu dẫn dắt rõ ràng theo đúng khuôn mẫu ĐATN

**Đề xuất:** Thêm 1–2 câu cuối phần mở đầu nêu rõ: "Chương 1 được tổ chức thành bốn phần chính: (i) Đặt vấn đề... (ii) Mục tiêu và phạm vi... (iii) Định hướng giải pháp... (iv) Bố cục đồ án..."

---

### Chương 2 — CƠ SỞ LÝ THUYẾT (dòng 499–509)
**Đánh giá: ⚠️ MAJOR**

Tổng quan chỉ có 2 đoạn ngắn:
- ✅ Liên kết với Chương 1 ("Trong chương 1, đồ án đã trình bày...")
- ✅ Nêu định hướng khảo sát chung
- ❌ **Không liệt kê các section sẽ trình bày trong chương** (Khảo sát hiện trạng, Xu hướng, So sánh giải pháp, Tổng quan chức năng, Đặc tả 6 use case, Yêu cầu phi chức năng)
- ❌ Quá ngắn (2 đoạn, ~10 dòng) so với khối lượng nội dung chương (>300 dòng)

**Đề xuất:** Bổ sung đoạn thứ 3 liệt kê các mục lớn theo đúng khuôn mẫu.

---

### Chương 3 — CÔNG NGHỆ VÀ KIẾN TRÚC HỆ THỐNG (dòng 838–840)
**Đánh giá: ❌ CRITICAL**

```latex
\chapter{CÔNG NGHỆ VÀ KIẾN TRÚC HỆ THỐNG}

\section{Kiến trúc hệ thống}  ← bắt đầu ngay, không có Tổng quan
```

**Chương 3 KHÔNG có bất kỳ đoạn Tổng quan nào trước section đầu tiên.** Đây là vi phạm nghiêm trọng nhất trong báo cáo.

- ❌ Không liên kết với Chương 2
- ❌ Không giải thích lý do xuất hiện của Chương 3
- ❌ Không liệt kê nội dung sẽ trình bày (7 section: Kiến trúc, Backend, Frontend, CSDL, Xác thực, Mobile, Hạ tầng, Trực quan hóa)

**Đề xuất:** Thêm đoạn Tổng quan 2–3 đoạn trước `\section{Kiến trúc hệ thống}`.

---

### Chương 4 — THIẾT KẾ, TRIỂN KHAI VÀ ĐÁNH GIÁ (dòng 1010–1013)
**Đánh giá: ⚠️ MAJOR**

Có đoạn mở đầu nhưng không đạt yêu cầu:

```
Chương này trình bày các quyết định kiến trúc phần mềm và cấu trúc tổ chức
mã nguồn của hệ thống. Trọng tâm là phân tích lý do lựa chọn mô hình kiến trúc
và mô tả chi tiết các thành phần (package) cùng mối quan hệ phụ thuộc giữa
chúng, làm nền tảng cho các chương triển khai và kiểm thử tiếp theo.
```

- ❌ **Không liên kết với Chương 3** ("Chương 3 đã trình bày... Tiếp nối...")
- ❌ Không liệt kê các mục sẽ trình bày (chỉ có 2 subsection: Lựa chọn kiến trúc, Thiết kế tổng quan)
- ⚠️ Cụm "làm nền tảng cho các chương triển khai" không chính xác vì đây ĐÃ là chương triển khai

**Đề xuất:** Viết lại Tổng quan với cấu trúc: liên kết Ch3 → lý do Ch4 tồn tại → liệt kê 2 mục.

---

## 2. KIỂM TRA PHẦN KẾT CHƯƠNG

### Chương 1 — Kết chương (dòng 487–491)
**Đánh giá: ✅ ĐẠT — Minor**

Kết chương nằm cuối section "Bố cục đồ án", đặt ở vị trí hợp lý.
- ✅ Tổng kết nội dung
- ✅ Dẫn sang Chương 2
- ⚠️ Minor: Quá ngắn, chưa nêu kết quả cụ thể đạt được (chỉ nói "phác thảo bức tranh")

---

### Chương 2 — Kết chương (dòng 827–832)
**Đánh giá: ✅ ĐẠT — Minor**

Kết chương là đoạn cuối cùng của section "Yêu cầu phi chức năng" (embedded trong section, không tách rời).
- ✅ Tổng kết
- ✅ Dẫn sang Chương 3
- ⚠️ Minor: Embedded trong section nội dung, không thể phân biệt rõ là Kết chương
- ⚠️ Minor: Nội dung kết chương nói về "yêu cầu phi chức năng" nhưng thực ra cả chương có nhiều nội dung hơn thế

---

### Chương 3 — Kết chương (dòng 998–1002)
**Đánh giá: ✅ ĐẠT — Minor**

Đoạn cuối section "Công nghệ trực quan hóa".
- ✅ Tổng kết
- ✅ Dẫn sang Chương 4
- ⚠️ Minor: Embedded trong section cuối, không tách rời thành Kết chương độc lập

---

### Chương 4 — Kết chương (dòng 1196–1202)
**Đánh giá: ✅ ĐẠT**

- ✅ Tổng kết nội dung kiến trúc phân tầng
- ✅ Dẫn sang Chương 5
- ✅ Cụ thể hơn so với các kết chương khác

---

## 3. KIỂM TRA TÍNH LIÊN KẾT GIỮA CÁC CHƯƠNG

### Chuỗi liên kết

```
Ch1 Kết → Ch2 Tổng quan:  ✅ OK ("Trong chương 1, đồ án đã trình bày...")
Ch2 Kết → Ch3 Tổng quan:  ❌ ĐỨTMẠCH — Ch3 không có Tổng quan
Ch3 Kết → Ch4 Tổng quan:  ⚠️ YẾU — Ch4 có Tổng quan nhưng không nhắc Ch3
Ch4 Kết → Ch5:             ✅ OK (Ch5 chưa viết, câu dẫn đã có)
```

### Lỗi cụ thể

**[CRITICAL] Chương 3 không có tổng quan** → đứt mạch hoàn toàn Ch2→Ch3.

**[MAJOR] Chương 4 tổng quan không nhắc Ch3:** Câu "Chương này trình bày..." không có từ nào liên kết ngược về Ch3, vi phạm quy định "Tổng quan của chương N phải tham chiếu hợp lý đến chương N-1."

---

## 4. KIỂM TRA ĐỊNH DẠNG

### Tổng quan
Sau các lần chỉnh sửa gần đây, định dạng body text đã được làm sạch tốt.

### Các vị trí `\textbf{}` còn lại
Tất cả đều nằm trong **ngoại lệ hợp lệ**:
- Dòng 153–155: Title page (label bảng thông tin) ✅
- Dòng 222: Header bảng Danh mục ký hiệu ✅
- Dòng 602: Header bảng So sánh giải pháp ✅
- Dòng 1090: Header bảng Tổng quan kiến trúc ✅

**Không có `\textbf{}` vi phạm trong body text. ✅**

### `\textit{}` còn lại
- Dòng 201: `{\itshape (Ký và ghi rõ họ tên)}` — form label trong Tóm tắt ✅

**Không có `\textit{}` vi phạm trong body text. ✅**

### Vấn đề định dạng ẩn — `\texttt{}`
Các dòng 844, 858, 867, 893–895, 907, v.v. dùng `\texttt{}` để định dạng tên biến/module trong code. Theo chuẩn học thuật, `\texttt{}` cho tên kỹ thuật trong văn bản là **chấp nhận được** và không vi phạm quy định.

### Vấn đề: Đoạn phân rã chức năng (dòng 669–683)
**Đánh giá: ⚠️ MAJOR**

Đoạn này có 7 đoạn "mini" mỗi đoạn 2 dòng, mỗi đoạn bắt đầu bằng tên nhóm chức năng:

```
Đăng ký và hồ sơ: phân rã thành...
Tra cứu và hỗ trợ: phân rã thành...
Cấu hình chính sách: phân rã thành...
...
```

Đây thực chất là **bullet list ẩn** viết dưới dạng đoạn văn ngắn. Theo quy định, body text phải là đoạn văn phân tích hoàn chỉnh, không phải dạng liệt kê. 

**Đề xuất:** Gộp thành 2–3 đoạn văn hoàn chỉnh, phân tích theo nhóm chức năng.

---

## 5. KIỂM TRA TÍNH NHẤT QUÁN

### Vấn đề nghiêm trọng nhất: Bố cục đồ án KHÔNG khớp nội dung thực tế

**[CRITICAL]** Phần "Bố cục đồ án" (Chương 1, dòng 453–485) mô tả từng chương theo một cách, nhưng nội dung thực tế lại khác hoàn toàn:

| Chương | Mô tả trong Bố cục | Nội dung thực tế | Kết luận |
|--------|-------------------|------------------|----------|
| Ch2 | "khảo sát lý thuyết, thuật toán xếp hạng, ghép cặp" | Khảo sát người dùng, use case, yêu cầu hệ thống | ❌ Sai hoàn toàn |
| Ch3 | "yêu cầu chức năng, use case, mô hình dữ liệu, Allocation Engine" | Stack công nghệ, kiến trúc | ❌ Sai hoàn toàn |
| Ch4 | "triển khai Allocation Engine, realtime, bảo mật, hướng dẫn triển khai" | Chỉ có MVC + package overview | ⚠️ Mô tả vượt nội dung hiện có |

Người đọc đọc phần Bố cục ở Chương 1 rồi đọc Chương 2 sẽ thấy ngay mâu thuẫn.

### Vấn đề công nghệ chưa triển khai

**[MAJOR]** Dòng 996, Chương 3:
```
Là định hướng mở rộng, hệ thống đề xuất bổ sung module dựng hình bằng Blender 
theo quy trình: ... xuất tài sản 3D định dạng glTF và render bằng Three.js...
```

Blender, glTF, Three.js **không tồn tại trong source code** và không có bằng chứng triển khai. Đây là nội dung "định hướng tương lai" nhưng được đặt trong section mô tả công nghệ đã dùng. Báo cáo ĐATN phải mô tả những gì đã làm, không phải những gì dự định làm.

### Công nghệ được xác nhận là khớp với source code ✅

| Công nghệ | Chương đề cập | Trạng thái |
|-----------|--------------|------------|
| MongoDB Atlas + Mongoose | 1, 2, 3, 4 | ✅ Tồn tại trong code |
| Redis + Socket.IO adapter | 1, 2, 3, 4 | ✅ Tồn tại |
| EJS + Bootstrap | 1, 2, 3, 4 | ✅ Tồn tại |
| React Native + Expo SDK 52 | 3 | ✅ Tồn tại |
| Expo Router v4 | 3 | ✅ Tồn tại |
| TanStack Query v5 + Zustand | 3 | ✅ Tồn tại |
| Sentry | 3 | ✅ Tồn tại |
| MVC + Service Layer | 4 | ✅ Tồn tại |
| JWT + RBAC | 1, 2, 3 | ✅ Tồn tại |
| Leaflet.js | 3 | ✅ Tồn tại |
| Docker + Docker Compose | 3 | ✅ Tồn tại |
| GitHub Actions CI | 3 | ✅ Tồn tại |
| **Three.js / Blender / glTF** | **3** | **❌ Không có trong source** |

---

## 6. KIỂM TRA HÌNH ẢNH

### Danh sách hình hiện có

| # | File ảnh | Môi trường | Caption | Label | Giải thích trong text | Đánh giá |
|---|----------|-----------|---------|-------|----------------------|----------|
| — | `image/Scape.png` | `\begin{center}` | Informal | Không có | ✅ có text mô tả | ✅ Không vào LoF |
| 2.1 | `diagrams/usecase_overview.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 2.2 | `diagrams/phanra.png` | `\begin{figure}` | ✅ | ✅ | ⚠️ Partial | ⚠️ |
| 2.3 | `diagrams/usecase_registration.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 2.4 | `diagrams/usecase_config.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 2.5 | `diagrams/usecase_simulation.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 2.6 | `diagrams/usecase_lookup.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 2.7 | `diagrams/usecase_rooms.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 2.8 | `diagrams/usecase_notifications.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |
| 4.1 | `diagrams/package_diagram.png` | `\begin{figure}` | ✅ | ✅ | ✅ | ✅ |

### Vấn đề hình ảnh

**[RESOLVED] Scape image:** Hiện đã ở `\begin{center}` không có figure number, không vào danh mục hình vẽ. ✅

**[Minor] `phanra.png` (Hình 2.2):** Phần giải thích bên dưới hình (dòng 669–683) là 7 đoạn mini-paragraph dạng liệt kê, không phải đoạn văn phân tích hoàn chỉnh.

**[Minor] Package diagram không có đoạn dẫn chiếu trực tiếp:** Dòng 1070–1072 có `Hình~\ref{fig:package_diagram}` ✅, nhưng đoạn phân tích sau bảng 1081 không explicitly tham chiếu lại hình.

---

## 7. KIỂM TRA ĐỘ DÀI VÀ CHẤT LƯỢNG NỘI DUNG

### Chương 1 — Độ dài ổn
- ✅ Đặt vấn đề: đủ chi tiết (~5 đoạn)
- ✅ Mục tiêu + Phạm vi: rõ ràng
- ✅ Định hướng giải pháp: đầy đủ
- ✅ Bố cục: có nhưng nội dung mô tả sai (xem mục 5)

### Chương 2 — Cấu trúc bất thường

**[MAJOR] Section "Tổng quan chức năng" (dòng 628) — Quá ngắn và vị trí sai**

Chỉ có 2 đoạn (~8 dòng) trước khi nhảy vào use cases. Đây là cầu nối quan trọng nhưng quá mỏng.

**[MAJOR] TOC bất thường:** 
Dòng 642–643:
```latex
\addcontentsline{toc}{section}{Biểu đồ các trường hợp sử dụng}
\subsection*{2.2.1 Biểu đồ use case tổng quát}
```
Section "Biểu đồ các trường hợp sử dụng" được thêm vào TOC bằng tay bằng `\addcontentsline` nhưng lại nằm trong section "Tổng quan chức năng". Người đọc sẽ thấy 2 section-level entries khác nhau trong TOC nhưng thực chất là cùng một nội dung. Cấu trúc này gây nhầm lẫn.

**[Minor] UC4, UC5, UC6 quá ngắn:**
- UC4 (Tra cứu + khiếu nại): 2 đoạn ngắn cho use case phức tạp
- UC5 (Quản lý phòng): 2 đoạn ngắn
- UC6 (Thông báo + audit): 2 đoạn ngắn

### Chương 3 — Cấu trúc có vấn đề

**[MAJOR] Section "Kiến trúc hệ thống" (dòng 840–848) — Nội dung quá kỹ thuật**

Đoạn đầu tiên (dòng 842) chứa các cụm kỹ thuật như "allocation cycle", "policy inheritance", "violation workflow" mà KHÔNG được giải thích trước đó. Người đọc không làm code sẽ không hiểu.

**[MAJOR] Section "Công nghệ trực quan hóa và bản đồ" (dòng 985–996) — Quá ngắn + nội dung sai**

- Chỉ ~10 dòng văn bản
- Đề cập Blender/Three.js không có trong source code
- Nội dung về Leaflet chỉ được giải thích ~3 dòng cho một tính năng quan trọng

**[Minor] "Section Xác thực và bảo mật" vs "Section Ứng dụng di động"**

Các section này mô tả chi tiết kỹ thuật rất cụ thể (TTL token, jti, HMAC-SHA256...). Trong một ĐATN, phần này nên có thêm phân tích tại sao lựa chọn giải pháp đó thay vì chỉ liệt kê thông số kỹ thuật.

### Chương 4 — Nội dung ít hơn cam kết

**[CRITICAL] Khoảng cách giữa cam kết và thực tế:**

Section "Bố cục đồ án" (Chương 1) cam kết Chương 4 sẽ có:
- Chi tiết triển khai Allocation Engine ❌ Chưa có
- Hệ thống realtime ❌ Chưa có
- Bảo mật đa tầng ❌ Chưa có (đã mô tả ở Ch3)
- Hướng dẫn triển khai môi trường ❌ Chưa có

Chương 4 hiện tại CHỈ có:
- Lựa chọn kiến trúc MVC + Service Layer ✅
- Package diagram + tổ chức package ✅

**[Minor] Đoạn dư trong package description (dòng 1137–1138):**
```
Tổ chức package của ứng dụng di động phản ánh kiến trúc tương tự phía backend.
Ứng dụng di động (React Native/Expo) được tổ chức theo kiến trúc phân lớp
tương tự phía backend.
```
Hai câu đầu bị lặp ý ("tương tự phía backend" xuất hiện 2 lần liền).

---

## 8. TỔNG HỢP LỖI THEO MỨC ĐỘ

### 🔴 CRITICAL (cần sửa ngay, ảnh hưởng nghiêm trọng đến điểm báo cáo)

| ID | Vị trí | Mô tả |
|----|--------|-------|
| C1 | Chương 3, dòng 838 | **Không có phần Tổng quan chương** — vi phạm quy định ĐATN |
| C2 | Chương 1, dòng 453–485 | **Bố cục đồ án mô tả sai hoàn toàn nội dung thực tế** của Ch2 và Ch3 |
| C3 | Chương 4, dòng 1010 | **Tổng quan Ch4 không liên kết Ch3** — đứt mạch logic |

### 🟠 MAJOR (ảnh hưởng đáng kể đến chất lượng học thuật)

| ID | Vị trí | Mô tả |
|----|--------|-------|
| M1 | Chương 1, dòng 264–293 | Tổng quan không liệt kê các mục sẽ trình bày |
| M2 | Chương 2, dòng 506–509 | Tổng quan không liệt kê các mục sẽ trình bày |
| M3 | Chương 2, dòng 669–683 | 7 mini-paragraph phân rã chức năng = bullet list ẩn |
| M4 | Chương 2, dòng 628–643 | Cấu trúc TOC bất thường: section "Biểu đồ use case" vừa là section ẩn vừa là subsection* |
| M5 | Chương 3, dòng 996 | Đề cập Blender/Three.js không tồn tại trong source code |
| M6 | Chương 3, dòng 985–996 | Section "Công nghệ trực quan hóa" quá ngắn (~10 dòng) |
| M7 | Chương 4, dòng 1010–1013 | Tổng quan Ch4 không liên kết Ch3, không liệt kê mục |

### 🟡 MINOR (ảnh hưởng nhỏ, nên sửa khi có thời gian)

| ID | Vị trí | Mô tả |
|----|--------|-------|
| m1 | Chương 1, dòng 487–491 | Kết chương quá ngắn, chưa nêu kết quả cụ thể |
| m2 | Chương 2, dòng 827–832 | Kết chương embedded trong body section cuối |
| m3 | Chương 3, dòng 998–1002 | Kết chương embedded trong body section cuối |
| m4 | Chương 2, UC4/UC5/UC6 | Mô tả quá ngắn cho use case phức tạp |
| m5 | Chương 3, dòng 842 | Dùng thuật ngữ kỹ thuật chưa được định nghĩa (allocation cycle...) |
| m6 | Chương 4, dòng 1137–1138 | Lặp ý "tương tự phía backend" 2 lần liền |
| m7 | Chương 2, dòng 628–635 | Section "Tổng quan chức năng" chỉ 2 đoạn (~8 dòng) — quá mỏng |

---

## 9. ƯỚC TÍNH CHẤT LƯỢNG TỪNG CHƯƠNG

| Chương | Điểm | Nhận xét tóm tắt |
|--------|------|-----------------|
| **Chương 1** | **7/10** | Nội dung tốt, bố cục hợp lý. Lỗi chính: (1) Tổng quan thiếu danh mục mục; (2) Bố cục đồ án mô tả sai các chương tiếp theo |
| **Chương 2** | **6/10** | Có cấu trúc nhưng: Tổng quan thiếu danh mục mục; phần phân rã chức năng là bullet list ẩn; cấu trúc TOC bất thường; use case ngắn |
| **Chương 3** | **5/10** | Nội dung kỹ thuật tốt nhưng vi phạm nghiêm trọng: thiếu Tổng quan chương; đề cập công nghệ không tồn tại; không liên kết Ch2 |
| **Chương 4** | **6/10** | Tổng quan có nhưng không đạt chuẩn; nội dung thực tế ít hơn nhiều so với cam kết trong Bố cục đồ án |

---

## 10. ĐỀ XUẤT THỨ TỰ SỬA THEO ƯU TIÊN

```
Ưu tiên 1 — CRITICAL (sửa trước):
  1. [C1] Thêm Tổng quan Chương 3 (2–3 đoạn, liên kết Ch2, liệt kê 7 sections)
  2. [C2] Cập nhật phần "Bố cục đồ án" trong Ch1 cho khớp với nội dung thực tế
  3. [C3] Sửa Tổng quan Ch4 để liên kết Ch3

Ưu tiên 2 — MAJOR:
  4. [M1] Thêm câu liệt kê mục vào Tổng quan Ch1
  5. [M2] Thêm câu liệt kê mục vào Tổng quan Ch2
  6. [M3] Viết lại 7 mini-paragraph phân rã thành đoạn văn hoàn chỉnh
  7. [M5] Xóa hoặc chuyển đoạn Blender/Three.js sang "Định hướng tương lai"
  8. [M4] Sửa cấu trúc TOC section "Biểu đồ use case"

Ưu tiên 3 — MINOR:
  9. [m6] Xóa câu lặp ý ở dòng 1137–1138
  10. [m1–m4] Cải thiện kết chương, mở rộng UC4–UC6
```

---

*Audit hoàn thành. Chờ xác nhận trước khi sửa v2.tex.*
