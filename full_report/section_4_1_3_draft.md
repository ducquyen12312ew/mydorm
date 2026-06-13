# DRAFT: Nội dung mục 4.1.3 (chờ duyệt trước khi chèn vào v2.tex)

---

## LaTeX content để chèn vào v2.tex

Vị trí chèn: sau dòng 1194 (kết thúc đoạn cuối của 4.1.2), trước đoạn kết của chương.

---

```latex
\subsection{Thiết kế chi tiết gói}
\label{subsec:package_detail}

Mục này đi sâu vào cấu trúc nội tại của ba package có vai trò cốt lõi trong
hệ thống: Allocation Package thực thi toàn bộ thuật toán phân bổ phòng tự
động, Notification and Realtime Package điều phối thông báo thời gian thực
qua Socket.IO và Redis, và Authentication Package quản lý vòng đời xác thực
cho cả web portal lẫn ứng dụng di động. Với mỗi package, một Class Diagram
riêng biệt được trình bày nhằm làm rõ các lớp tham gia và quan hệ cấu trúc
giữa chúng, độc lập với Package Diagram tổng thể đã trình bày ở mục~\ref{subsec:package_overview}.

% ---------------------------------------------------------
\subsubsection*{Allocation Package}
% ---------------------------------------------------------

Hình~\ref{fig:class_allocation} trình bày Class Diagram của Allocation Package,
thể hiện các lớp trực tiếp tham gia vào quy trình phân bổ phòng tự động và
mối quan hệ giữa chúng.

\begin{figure}[H]
\centering
\includegraphics[width=0.92\textwidth]{diagrams/class_allocation.png}
\caption{Class Diagram của Allocation Package}
\label{fig:class_allocation}
\end{figure}

\texttt{AllocationService} là lớp điều phối trung tâm của package, chịu trách
nhiệm thực thi toàn bộ quy trình phân bổ từ lúc khởi động đến lúc ghi kết
quả. Lớp này phụ thuộc trực tiếp vào bốn schema \texttt{AllocationPolicy},
\texttt{AllocationCycle}, \texttt{AllocationRegistration} và
\texttt{RoomAllocation} để đọc đầu vào, tính toán và ghi kết quả phân bổ.
\texttt{AllocationPolicy} lưu trữ bộ tham số chính sách gồm trọng số điểm ưu
tiên và các ràng buộc phân bổ, trong khi \texttt{AllocationCycle} biểu diễn
một phiên phân bổ theo chu kỳ học kỳ với trạng thái và tham chiếu đến chính
sách đang áp dụng. Thiết kế tách biệt giữa chính sách (\texttt{AllocationPolicy})
và chu kỳ (\texttt{AllocationCycle}) cho phép một chính sách được tái sử dụng
qua nhiều chu kỳ mà không cần nhân bản cấu hình.

\texttt{AllocationRegistration} lưu đơn đăng ký của từng sinh viên trong một
chu kỳ cụ thể, bao gồm điểm ưu tiên đã tính toán theo công thức kết hợp ba
tiêu chí: khoảng cách địa lý (35\%), hoàn cảnh kinh tế (35\%) và mức độ ưu
tiên chính sách (30\%). \texttt{AllocationService} đọc toàn bộ các đơn này
trong một chu kỳ, sắp xếp theo điểm từ cao đến thấp và thực hiện gán phòng
tuần tự, kết quả được lưu vào \texttt{RoomAllocation} là một bản ghi bất biến
thể hiện mối liên kết giữa sinh viên và phòng được cấp.

\texttt{AllocationAuditLog} ghi lại toàn bộ hành động thực hiện trong một
phiên phân bổ, bao gồm thời điểm bắt đầu, tham số đầu vào, từng quyết định
gán phòng và trạng thái kết thúc. \texttt{AllocationService} phụ thuộc vào
lớp này theo chiều một chiều: mọi thay đổi trạng thái đều được ghi nhận ngay
lập tức để đảm bảo khả năng truy vết đầy đủ khi có yêu cầu kiểm tra.
\texttt{SimulationService} phụ thuộc vào \texttt{AllocationService} theo quan
hệ sử dụng: lớp này chạy toàn bộ thuật toán phân bổ trong môi trường sandbox,
sử dụng dữ liệu thực nhưng không ghi kết quả vào cơ sở dữ liệu chính thức,
cho phép cán bộ quản lý đánh giá tác động của cấu hình trước khi xác nhận thực
thi. Sau khi thực thi phân bổ thành công, \texttt{AllocationService} kích hoạt
\texttt{DurableEventPublisher} để phát sự kiện \texttt{STUDENT\_ASSIGNED} vào
hàng đợi sự kiện bền vững, tạo cầu nối sang Notification Package.

% ---------------------------------------------------------
\subsubsection*{Notification and Realtime Package}
% ---------------------------------------------------------

Hình~\ref{fig:class_notification} trình bày Class Diagram của Notification and
Realtime Package, thể hiện các lớp phối hợp để phân phối thông báo thời gian
thực từ backend đến client.

\begin{figure}[H]
\centering
\includegraphics[width=0.92\textwidth]{diagrams/class_notification.png}
\caption{Class Diagram của Notification and Realtime Package}
\label{fig:class_notification}
\end{figure}

\texttt{StudentSocketServer} là điểm khởi tạo của toàn bộ cơ sở hạ tầng
realtime. Lớp này tạo một instance \texttt{Server} của Socket.IO trên cùng
HTTP server với Express, cấu hình pipeline xác thực nhận dạng người dùng qua
session hoặc JWT, sau đó uỷ thác hai nhiệm vụ cốt lõi cho
\texttt{DomainEventBridge} và \texttt{RedisAdapter}. Mỗi kết nối thành công
được đặt vào phòng Socket.IO riêng có tên \texttt{student:\{userId\}}, đảm bảo
thông báo được định tuyến chính xác đến đúng người nhận.

\texttt{DomainEventBridge} là cầu nối giữa hệ thống sự kiện bất đồng bộ và
lớp Socket.IO. Lớp này lắng nghe \texttt{DomainEventBus} --- một EventEmitter
Node.js --- và khi nhận được sự kiện \texttt{STUDENT\_ASSIGNED} hay
\texttt{APPLICATION\_UPDATED}, nó phát ngay lập tức thông điệp WebSocket đến
phòng của sinh viên tương ứng. Cơ chế idempotency được triển khai bằng một
tập hợp \texttt{handledEventIds} để loại bỏ sự kiện trùng lặp, điều này đặc
biệt quan trọng khi \texttt{RedisAdapter} phân phối cùng một sự kiện qua nhiều
server instance. \texttt{DurableEventPublisher} đảm bảo độ bền của sự kiện
bằng cách ghi trước vào \texttt{DomainEventOutbox} trong MongoDB trước khi
phát lên \texttt{DomainEventBus}; nếu server gặp sự cố giữa chừng, các sự kiện
trong outbox vẫn còn nguyên và có thể được phát lại.

\texttt{RedisAdapter} kết nối Socket.IO với Redis theo mô hình pub/sub bằng
cách tạo một cặp Redis client publisher/subscriber, cho phép nhiều instance
server đồng bộ broadcast event với nhau. Thiết kế này đảm bảo rằng khi hệ
thống được mở rộng theo chiều ngang, thông báo phát từ bất kỳ instance nào
đều đến được mọi client, bất kể client đó đang kết nối vào instance nào.
\texttt{NotificationHelper} và \texttt{NotificationService} phục vụ hai kênh
khác biệt: lớp đầu tạo bản ghi thông báo trong \texttt{NotificationSchema} để
sinh viên truy xuất qua giao diện, lớp sau gửi thông báo qua email và SMS khi
cần liên lạc ngoài kênh WebSocket.

% ---------------------------------------------------------
\subsubsection*{Authentication Package}
% ---------------------------------------------------------

Hình~\ref{fig:class_auth} trình bày Class Diagram của Authentication Package,
thể hiện hai luồng xác thực song song và các lớp hỗ trợ tăng cường bảo mật.

\begin{figure}[H]
\centering
\includegraphics[width=0.86\textwidth]{diagrams/class_auth.png}
\caption{Class Diagram của Authentication Package}
\label{fig:class_auth}
\end{figure}

Hệ thống duy trì hai luồng xác thực song song phù hợp với hai loại client.
\texttt{AuthMiddleware} phục vụ web portal bằng cơ chế session-based: nó kiểm
tra sự tồn tại của \texttt{req.session.userId} và trường \texttt{role} trong
session do express-session quản lý; không có phụ thuộc vào schema hay thư viện
JWT. \texttt{MobileJwtAuth} phục vụ ứng dụng di động bằng Bearer token: nó
trích xuất JWT từ header Authorization và uỷ thác việc xác minh cho
\texttt{MobileTokenService}. Sự phân tách này tránh được việc một middleware
phải xử lý hai giao thức xác thực khác nhau, giảm nguy cơ lỗi logic khi hệ
thống mở rộng.

\texttt{MobileTokenService} quản lý toàn bộ vòng đời token cho ứng dụng di
động: cấp cặp access token (15 phút) và refresh token (30 ngày), xác minh chữ
ký JWT, luân phiên refresh token khi access token hết hạn và thu hồi token khi
người dùng đăng xuất. Refresh token được lưu ở dạng hash SHA-256 trong
\texttt{MobileRefreshToken}, không bao giờ lưu plaintext, đảm bảo rằng ngay
cả khi cơ sở dữ liệu bị truy cập trái phép, kẻ tấn công không thể tái sử dụng
các giá trị đó. Lớp này còn triển khai cơ chế phát hiện bất thường bằng hàm
\texttt{computeRiskScore}: nếu điểm rủi ro vượt ngưỡng 70 do sự thay đổi đột
ngột về thiết bị hoặc địa lý, phiên làm việc bị chấm dứt và cảnh báo bảo mật
được ghi nhận.

\texttt{TwoFactorService} cung cấp xác thực hai yếu tố theo chuẩn TOTP: tạo
bí mật TOTP bằng thư viện speakeasy, sinh mã QR để người dùng nhập vào ứng
dụng authenticator, và xác minh mã OTP sáu chữ số theo cửa sổ thời gian 30
giây. Lớp này hoàn toàn không phụ thuộc vào tầng dữ liệu; việc lưu trữ bí
mật TOTP vào \texttt{TwoFactorSchema} được thực hiện bởi route handler tương
ứng, giữ cho \texttt{TwoFactorService} là một thành phần thuần tuý không có
side effect, dễ kiểm thử độc lập.
```

---

## Đoạn kết chương cập nhật

Thay thế đoạn hiện tại (dòng 1196-1202) bằng:

```latex
Thông qua ba mục của phần~\ref{sec:arch_design}, chương 4 đã trình bày đầy
đủ quyết định lựa chọn kiến trúc MVC kết hợp Service Layer, cấu trúc tổ chức
gói theo kiến trúc phân tầng và thiết kế nội tại của ba package cốt lõi:
Allocation, Notification and Realtime, và Authentication. Các nguyên tắc phụ
thuộc một chiều và phân tách trách nhiệm được duy trì nhất quán từ mức kiến
trúc tổng thể xuống đến mức lớp trong từng package, đảm bảo hệ thống có thể
mở rộng và bảo trì mà không làm phức tạp thêm các phần đã ổn định. Chương 5
tiếp theo sẽ trình bày chiến lược kiểm thử và đánh giá kết quả vận hành thực
tế của hệ thống.
```

---

## Ghi chú

- `\section{Thiết kế kiến trúc}` cần thêm `\label{sec:arch_design}` để cross-reference hoạt động
- Các file PNG diagram cần được đặt tại: `full_report/diagrams/class_allocation.png`, `class_notification.png`, `class_auth.png`
- PlantUML code cho từng diagram xem trong HUONG_DAN_VE_CLASS_DIAGRAM.md
