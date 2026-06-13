# Font System Audit

## Font cũ đã loại bỏ
| Font | Tìm thấy ở | Trạng thái |
|------|-----------|------------|
| Quicksand | home.css, premium-home.css, student.css, student-registration-portal.css, student/home.ejs, student/list.ejs, student/room-status.ejs, student/profile.ejs, student/register.ejs, student/priority-claims.ejs, student/maintenance-requests.ejs, student/student-registration-portal.ejs, public/startuphome.ejs, public/room-detail.ejs, public/map.ejs | Đã xóa |
| Montserrat | home.css, premium-home.css, student-premium-shell.css, student.css + 11 EJS files | Đã xóa |
| Manrope | auth-forms.css, auth/login.ejs, auth/signup.ejs, public/dormitory-detail.ejs | Đã xóa |
| Space Grotesk | admin/master-dashboard.ejs, admin/master-dashboard-student.ejs | Đã xóa |
| Segoe UI / Tahoma / Geneva / Verdana | admin.css, admin-academic-policies.css, admin-priority-queue.css, admin-dashboard-modern.css, cohort-shift.css | Đã xóa |
| system-ui stack (-apple-system, BlinkMacSystemFont...) | admin-dashboard-modern.css | Đã xóa |
| Anton, Roboto Condensed, Plus Jakarta Sans | public/map.ejs, public/dormitory-detail.ejs | Đã xóa |

## Font mới duy nhất
| Font | Weights | Fallback |
|------|---------|---------|
| Inter | 400, 500, 600, 700 | system-ui, sans-serif |

## File CSS đã chỉnh sửa
- public/css/home.css
- public/css/premium-home.css
- public/css/student-premium-shell.css
- public/css/student.css
- public/css/auth-forms.css
- public/css/admin.css
- public/css/admin-academic-policies.css
- public/css/admin-priority-queue.css
- public/css/admin-dashboard-modern.css
- public/css/cohort-shift.css
- public/css/student-registration-portal.css

## File EJS đã chỉnh sửa (Google Fonts links)
- views/auth/login.ejs
- views/auth/signup.ejs
- views/student/home.ejs
- views/student/list.ejs
- views/student/room-status.ejs
- views/student/profile.ejs
- views/student/register.ejs
- views/student/priority-claims.ejs
- views/student/maintenance-requests.ejs
- views/student/student-registration-portal.ejs
- views/public/startuphome.ejs
- views/public/room-detail.ejs
- views/public/dormitory-detail.ejs
- views/admin/master-dashboard.ejs
- views/admin/master-dashboard-student.ejs
- views/public/map.ejs

## File EJS đã chỉnh sửa (inline styles)
- views/student/enhanced-application-form.ejs
- views/student/explore-rooms.ejs
- views/admin/violations/admin-violations.ejs
- views/admin/allocation/dashboard.ejs

## Typography scale cuối cùng
| Element | Size | Weight |
|---------|------|--------|
| h1 | 32px | 700 |
| h2 | 28px | 700 |
| h3 | 24px | 600 |
| h4 | 20px | 600 |
| body | 14–16px | 400 |
| small | 12px | 400 |
