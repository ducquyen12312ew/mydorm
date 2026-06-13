# Đề xuất vị trí trích dẫn học thuật cho Chương 3 và Chương 4

**Nguyên tắc:** Chỉ đề xuất nguồn có uy tín học thuật — Official Documentation, UML Specification, Academic Books, Conference Papers, IEEE/ACM. Không dùng Wikipedia, Blog, Medium, Viblo.

---

## 1. MVC Architecture

**Vị trí trong báo cáo:** Mục 4.1.1 — câu *"Hệ thống quản lý ký túc xá được xây dựng dựa trên kiến trúc MVC kết hợp Service Layer"*

**Nguồn đề xuất:**
- Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley. (Chapter 14: MVC — trang gốc của định nghĩa MVC trong web context)
- Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). *Design Patterns: Elements of Reusable Object-Oriented Software*. Addison-Wesley. (Observer pattern — nền tảng của MVC)

**Cách cite trong LaTeX:**
```latex
kiến trúc MVC kết hợp Service Layer~\cite{fowler2002patterns}
```

---

## 2. UML Package Diagram

**Vị trí trong báo cáo:** Mục 4.1.2 — câu *"Package Diagram trong UML 2.5 biểu diễn các đơn vị tổ chức mã nguồn"*

**Nguồn đề xuất:**
- Object Management Group (OMG). (2017). *OMG Unified Modeling Language (UML) Specification, Version 2.5.1*. Document formal/17-12-05. Truy cập tại: https://www.omg.org/spec/UML/2.5.1/PDF

**Cách cite trong LaTeX:**
```latex
Package Diagram trong UML 2.5~\cite{omg2017uml}
```

---

## 3. UML Class Diagram

**Vị trí trong báo cáo:** Mục 4.1.3 — câu mở đầu giải thích về Class Diagram (nếu có câu tổng quát về UML Class Diagram)

**Nguồn đề xuất:**
- Object Management Group (OMG). (2017). *OMG Unified Modeling Language (UML) Specification, Version 2.5.1*. (Cùng nguồn với Package Diagram — cite một lần dùng lại)
- Rumbaugh, J., Jacobson, I., & Booch, G. (2004). *The Unified Modeling Language Reference Manual* (2nd ed.). Addison-Wesley.

---

## 4. JWT Authentication

**Vị trí trong báo cáo:**
- Chương 3, mục Yêu cầu phi chức năng — câu *"toàn bộ API được bảo vệ bằng JWT kết hợp RBAC"*
- Mục 4.1.3, phần Authentication Package — câu mô tả MobileTokenService

**Nguồn đề xuất:**
- Jones, M., Bradley, J., & Sakimura, N. (2015). *JSON Web Token (JWT)*. RFC 7519. Internet Engineering Task Force (IETF). https://datatracker.ietf.org/doc/html/rfc7519
- Jones, M., & Hildebrand, J. (2015). *JSON Web Encryption (JWE)*. RFC 7516. IETF.

**Cách cite trong LaTeX:**
```latex
JSON Web Token (JWT)~\cite{rfc7519}
```

---

## 5. MongoDB

**Vị trí trong báo cáo:** Chương 3, mục Cơ sở dữ liệu; Chương 2 phần công nghệ

**Nguồn đề xuất:**
- Chodorow, K. (2013). *MongoDB: The Definitive Guide* (2nd ed.). O'Reilly Media. (Sách học thuật, O'Reilly)
- MongoDB, Inc. (2023). *MongoDB Manual*. https://www.mongodb.com/docs/manual/ (Official documentation)

**Lưu ý:** Nếu dùng official documentation, cite là:
```latex
MongoDB~\cite{mongodb_manual}
```
Với BibTeX entry:
```bibtex
@manual{mongodb_manual,
  title  = {{MongoDB} Manual},
  author = {{MongoDB, Inc.}},
  year   = {2023},
  url    = {https://www.mongodb.com/docs/manual/}
}
```

---

## 6. Socket.IO

**Vị trí trong báo cáo:**
- Chương 3, mục Yêu cầu phi chức năng — *"Socket.IO cho thông báo thời gian thực"*
- Mục 4.1.3, phần Notification Package

**Nguồn đề xuất:**
- Socket.IO. (2023). *Socket.IO Documentation*. https://socket.io/docs/v4/ (Official documentation)
- Grigorik, I. (2013). *High Performance Browser Networking*. O'Reilly Media. Chapter 17: WebSocket — lý thuyết nền tảng

Nếu muốn nguồn học thuật hơn:
- Pimentel, V., & Nickerson, B. G. (2012). Communicating and Displaying Real-Time Data with WebSocket. *IEEE Internet Computing*, 16(4), 45–53. DOI: 10.1109/MIC.2012.64

**Cách cite:**
```latex
thông báo thời gian thực qua WebSocket~\cite{pimentel2012websocket}
```

---

## 7. Redis Pub/Sub

**Vị trí trong báo cáo:** Mục 4.1.3, phần Notification Package — câu mô tả RedisAdapter

**Nguồn đề xuất:**
- Redis Ltd. (2023). *Redis Documentation: Pub/Sub*. https://redis.io/docs/manual/pubsub/ (Official documentation)
- Carlson, J. L. (2013). *Redis in Action*. Manning Publications. (Sách học thuật thực hành)

```bibtex
@book{carlson2013redis,
  title     = {Redis in Action},
  author    = {Carlson, Josiah L.},
  year      = {2013},
  publisher = {Manning Publications}
}
```

---

## 8. React Native

**Vị trí trong báo cáo:** Chương 3, mục Ứng dụng di động; Chương 2

**Nguồn đề xuất:**
- Facebook Inc. (Meta). (2023). *React Native Documentation*. https://reactnative.dev/docs/getting-started (Official documentation)
- Eisenman, B. (2016). *Learning React Native* (2nd ed.). O'Reilly Media.

Cho học thuật hơn:
- Hansson, S. L., & Einarsson, G. (2018). *Cross-platform mobile development with React Native*. Thesis, Chalmers University of Technology. (có thể tìm qua Google Scholar)

---

## Tổng hợp BibTeX entry đề xuất

```bibtex
@book{fowler2002patterns,
  title     = {Patterns of Enterprise Application Architecture},
  author    = {Fowler, Martin},
  year      = {2002},
  publisher = {Addison-Wesley},
  isbn      = {978-0321127426}
}

@techreport{omg2017uml,
  title       = {{OMG Unified Modeling Language (UML) Specification, Version 2.5.1}},
  author      = {{Object Management Group}},
  institution = {Object Management Group},
  year        = {2017},
  number      = {formal/17-12-05},
  url         = {https://www.omg.org/spec/UML/2.5.1/PDF}
}

@techreport{rfc7519,
  title       = {{JSON Web Token (JWT)}},
  author      = {Jones, Michael and Bradley, John and Sakimura, Nat},
  institution = {IETF},
  year        = {2015},
  number      = {RFC 7519},
  url         = {https://datatracker.ietf.org/doc/html/rfc7519}
}

@book{chodorow2013mongodb,
  title     = {{MongoDB: The Definitive Guide}},
  author    = {Chodorow, Kristina},
  edition   = {2},
  year      = {2013},
  publisher = {O'Reilly Media},
  isbn      = {978-1449344689}
}

@article{pimentel2012websocket,
  title   = {Communicating and Displaying Real-Time Data with {WebSocket}},
  author  = {Pimentel, Victoria and Nickerson, Bradford G.},
  journal = {IEEE Internet Computing},
  volume  = {16},
  number  = {4},
  pages   = {45--53},
  year    = {2012},
  doi     = {10.1109/MIC.2012.64}
}

@book{carlson2013redis,
  title     = {Redis in Action},
  author    = {Carlson, Josiah L.},
  year      = {2013},
  publisher = {Manning Publications},
  isbn      = {978-1617290855}
}

@book{eisenman2016react_native,
  title     = {Learning React Native},
  author    = {Eisenman, Bonnie},
  edition   = {2},
  year      = {2016},
  publisher = {O'Reilly Media},
  isbn      = {978-1491989661}
}
```

---

## Ưu tiên thực hiện

| Ưu tiên | Nguồn | Lý do |
|---------|-------|-------|
| Bắt buộc | OMG UML 2.5.1 | Chương 4 dùng thuật ngữ UML Package/Class Diagram |
| Bắt buộc | RFC 7519 (JWT) | Chương 3 và 4.1.3 đề cập JWT nhiều lần |
| Nên có | Fowler 2002 (MVC) | Mục 4.1.1 giải thích MVC |
| Nên có | Pimentel 2012 (WebSocket/IEEE) | Chương 3 NFR và 4.1.3 Notification Package |
| Tuỳ chọn | Chodorow 2013 (MongoDB) | Phần cơ sở dữ liệu |
| Tuỳ chọn | Carlson 2013 (Redis) | Mục 4.1.3 Notification Package |
