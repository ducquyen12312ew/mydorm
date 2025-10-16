const express = require("express");
const path = require("path");
const { StudentCollection, DormitoryCollection, PendingApplicationCollection,  NotificationCollection, ActivityLogCollection } = require('./config');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');
const dormitoryRoutes = require('./dormitory-routes');
const registrationRoutes = require('./registration-routes');
const adminApplicationRoutes = require('./admin-application-routes');
const roomStatusRoutes = require('./room-status-routes');

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 ngày
        sameSite: 'lax'
    },
    name: 'dormitory_session'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));


app.set("view engine", "ejs");

// API routes
app.use('/api', registrationRoutes);
app.use('/api', dormitoryRoutes);
app.use('/api', adminApplicationRoutes);
app.use('/', roomStatusRoutes);

app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null,
        id: req.session.userId || null
    };
    next();
});

// Middleware kiểm tra đăng nhập
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// Middleware kiểm tra quyền admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    res.redirect('/login');
};

app.get("/", (req, res) => {
    if (req.session && req.session.userId) {
        // Kiểm tra role của user để chuyển hướng đúng
        if (req.session.role === 'admin') {
            // Admin sẽ được chuyển đến trang admin
            res.redirect('/admin/dormitories');
        } else {
            // Sinh viên sẽ được hiển thị trang home.ejs
            res.render("home", {
                user: { 
                    name: req.session.name, 
                    role: req.session.role,
                    id: req.session.userId
                }
            });
        }
    } else {
        // Nếu chưa đăng nhập, hiển thị startuphome.ejs
        res.render("startuphome");
    }
});
app.get("/home", isAuthenticated, (req, res) => {
    if (req.session.role === 'admin') {
        return res.redirect('/admin/dormitories');
    }
    res.render("home", {
        user: { 
            name: req.session.name, 
            role: req.session.role,
            id: req.session.userId
        }
    });
});
app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.get("/register", isAuthenticated, (req, res) => {
    res.render("register");
});

async function createDefaultAdmin() {
    try {
        const adminExists = await StudentCollection.findOne({ role: 'admin' });
        if (!adminExists) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            
            await StudentCollection.create({
                name: 'Administrator',
                username: 'admin',
                password: hashedPassword,
                phone: '0987654321',
                email: 'admin@hust.edu.vn',
                role: 'admin'
            });
            
            console.log('Default admin account created');
        }
    } catch (error) {
        console.error('Error creating admin account:', error);
    }
}

createDefaultAdmin();
app.get("/profile", isAuthenticated, async (req, res) => {
    try {
        // Fetch student details with populated data
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }
        
        // If student has dormitoryId, fetch dormitory information
        let dormitory = null;
        let room = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId);
            
            // Find student's room if roomNumber is available
            if (dormitory && student.roomNumber) {
                for (const floor of dormitory.floors) {
                    const foundRoom = floor.rooms.find(r => r.roomNumber === student.roomNumber);
                    if (foundRoom) {
                        room = foundRoom;
                        break;
                    }
                }
            }
        }
        
        // Fetch student's application history
        const applications = await PendingApplicationCollection.find({
            studentId: student.studentId
        }).sort({ createdAt: -1 }).limit(5);
        
        // Render profile page with all collected data
        res.render("profile", {
            student,
            dormitory,
            room,
            applications,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Internal server error");
    }
});

// Route to update profile information
app.post('/update-profile', isAuthenticated, async (req, res) => {
    try {
        // Get updated information from request body
        const {
            name,
            studentId,
            email,
            phone,
            faculty,
            academicYear,
            gender
        } = req.body;

        // Find student and update
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        // Update session name if it changed
        if (name && name !== student.name) {
            req.session.name = name;
        }

        // Check if email changed and if the new email already exists
        if (email && email !== student.email) {
            const existingEmail = await StudentCollection.findOne({ email, _id: { $ne: req.session.userId } });
            if (existingEmail) {
                // Flash message would be nice here, but we'll redirect with query parameter instead
                return res.redirect('/profile?error=email_exists');
            }
        }

        // Update student information
        await StudentCollection.findByIdAndUpdate(req.session.userId, {
            name,
            studentId,
            email,
            phone,
            faculty,
            academicYear,
            gender
        });

        res.redirect('/profile?success=profile_updated');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/profile?error=update_failed');
    }
});

// Route to change password
app.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Check if new password and confirm password match
        if (newPassword !== confirmPassword) {
            return res.redirect('/profile?error=passwords_dont_match');
        }

        // Find student
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        // Check if current password is correct
        const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
        if (!isPasswordValid) {
            return res.redirect('/profile?error=incorrect_password');
        }

        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await StudentCollection.findByIdAndUpdate(req.session.userId, {
            password: hashedPassword
        });

        res.redirect('/profile?success=password_changed');
    } catch (error) {
        console.error('Error changing password:', error);
        res.redirect('/profile?error=password_change_failed');
    }
});

app.get("/profile", isAuthenticated, async (req, res) => {
    try {
        // Get any success or error messages from query parameters
        const success = req.query.success;
        const error = req.query.error;
        
        // Generate appropriate message based on query parameters
        let message = null;
        if (success) {
            switch (success) {
                case 'profile_updated':
                    message = { type: 'success', text: 'Thông tin cá nhân đã được cập nhật thành công.' };
                    break;
                case 'password_changed':
                    message = { type: 'success', text: 'Mật khẩu đã được thay đổi thành công.' };
                    break;
            }
        } else if (error) {
            switch (error) {
                case 'email_exists':
                    message = { type: 'error', text: 'Email này đã được sử dụng bởi tài khoản khác.' };
                    break;
                case 'update_failed':
                    message = { type: 'error', text: 'Có lỗi xảy ra khi cập nhật thông tin.' };
                    break;
                case 'passwords_dont_match':
                    message = { type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' };
                    break;
                case 'incorrect_password':
                    message = { type: 'error', text: 'Mật khẩu hiện tại không đúng.' };
                    break;
                case 'password_change_failed':
                    message = { type: 'error', text: 'Có lỗi xảy ra khi thay đổi mật khẩu.' };
                    break;
            }
        }
        
        // Fetch student details with populated data
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }
        
        // If student has dormitoryId, fetch dormitory information
        let dormitory = null;
        let room = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId);
            
            // Find student's room if roomNumber is available
            if (dormitory && student.roomNumber) {
                for (const floor of dormitory.floors) {
                    const foundRoom = floor.rooms.find(r => r.roomNumber === student.roomNumber);
                    if (foundRoom) {
                        room = foundRoom;
                        break;
                    }
                }
            }
        }
        
        // Fetch student's application history
        const applications = await PendingApplicationCollection.find({
            studentId: student.studentId
        }).sort({ createdAt: -1 }).limit(5);
        
        // Render profile page with all collected data
        res.render("profile", {
            student,
            dormitory,
            room,
            applications,
            message,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Internal server error");
    }
});

app.get("/map", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.render("map", { dormitories: JSON.stringify(dormitories) });
    } catch (error) {
        console.error("Error fetching dormitories for map:", error);
        res.render("map", { dormitories: "[]" });
    }
});

app.get("/admin/dormitories", isAdmin, async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.render("admin-dormitories", { 
            dormitories, 
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error fetching dormitories:", error);
        res.render("admin-dormitories", { 
            dormitories: [], 
            error: "Không thể lấy dữ liệu ký túc xá",
            user: { name: req.session.name, role: req.session.role }
        });
    }
});

app.get("/admin/application", isAdmin, async (req, res) => {
    try {
        res.render("admin-application", { 
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error rendering application page:", error);
        res.status(500).send("Internal server error");
    }
});

app.get("/admin/application/:id", isAdmin, async (req, res) => {
    try {
        res.render("admin-application-detail", { 
            applicationId: req.params.id,
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error rendering application detail page:", error);
        res.status(500).send("Internal server error");
    }
});

app.get("/admin/dormitories/add", isAdmin, (req, res) => {
    res.render("admin-dormitory-form", { 
        action: "add",
        dormitory: null,
        user: { name: req.session.name, role: req.session.role }
    });
});

app.get("/admin/dormitories/edit/:id", isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.redirect('/admin/dormitories');
        }
        res.render("admin-dormitory-form", { 
            action: "edit",
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching dormitory for edit:", error);
        res.redirect('/admin/dormitories');
    }
});

app.get("/admin/dormitories/view/:id", isAdmin, async (req, res) => {
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.redirect('/admin/dormitories');
        }
        res.render("admin-dormitory-view", { 
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching dormitory details:", error);
        res.redirect('/admin/dormitories');
    }
});

app.get("/profile", isAuthenticated, async (req, res) => {
    try {
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }
        
        // Nếu sinh viên có dormitoryId, lấy thông tin ký túc xá
        let dormitory = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId);
        }
        
        res.render("profile", {
            student,
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).send("Internal server error");
    }
});

app.get("/api/featured-dormitories", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find().limit(5);
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching featured dormitories:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu ký túc xá nổi bật" });
    }
});

app.post("/signup", async (req, res) => {
    try {
        const {
            username,
            password,
            name,
            email,
            phone,
            studentId,
            gender,
            faculty,
            academicYear
        } = req.body;

        // Kiểm tra username đã tồn tại chưa
        const existingUser = await StudentCollection.findOne({ username });
        if (existingUser) {
            return res.render("signup", { 
                error: "Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác." 
            });
        }

        // Kiểm tra email đã tồn tại chưa (nếu có)
        if (email) {
            const existingEmail = await StudentCollection.findOne({ email });
            if (existingEmail) {
                return res.render("signup", { 
                    error: "Email đã được sử dụng. Vui lòng sử dụng email khác." 
                });
            }
        }

        // Băm mật khẩu
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Tạo tài khoản mới
        const newStudent = await StudentCollection.create({
            username,
            password: hashedPassword,
            name,
            email,
            phone,
            studentId,
            gender,
            faculty,
            academicYear,
            role: 'user'
        });

        // Đăng nhập tự động sau khi đăng ký
        req.session.userId = newStudent._id;
        req.session.name = newStudent.name;
        req.session.role = newStudent.role;

        // ✨ THÊM MỚI: Tạo thông báo chào mừng
        await sendNotificationOnEvent('welcome', newStudent._id, {
            name: newStudent.name
        });

        // Chuyển hướng đến trang chủ
        res.redirect('/');
    } catch (error) {
        console.error("Error during signup:", error);
        res.render("signup", { 
            error: "Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại."
        });
    }
});

// Route xử lý đăng nhập
app.post("/login", async (req, res) => {
    try {
        const { username, password, remember } = req.body;

        // Tìm người dùng với username
        const student = await StudentCollection.findOne({ username });
        if (!student) {
            return res.render("login", { 
                error: "Tên đăng nhập hoặc mật khẩu không đúng" 
            });
        }

        // Kiểm tra mật khẩu
        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            return res.render("login", { 
                error: "Tên đăng nhập hoặc mật khẩu không đúng" 
            });
        }

        // Lưu thông tin vào session
        req.session.userId = student._id;
        req.session.name = student.name;
        req.session.role = student.role;
        req.session.studentId = student.studentId;
        
        // Nếu chọn ghi nhớ đăng nhập, kéo dài thời gian session
        if (remember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 ngày
        }

        // Đảm bảo session được lưu trước khi redirect
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.render("login", { 
                    error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
                });
            }

            // Chuyển hướng dựa vào vai trò
            if (student.role === "admin") {
                return res.redirect("/admin/dormitories");
            } else {
                return res.redirect("/");
            }
        });

    } catch (error) {
        console.error("Error during login:", error);
        res.render("login", { 
            error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
        });
    }
});
app.use('/debug-session', (req, res) => {
    res.json({
        sessionData: req.session,
        hasUserId: !!req.session.userId,
        role: req.session.role,
        name: req.session.name
    });
});
// Route xử lý forgot password
app.get("/forgot-password", (req, res) => {
    res.render("forgot-password");
});

app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        // Kiểm tra email có tồn tại không
        const student = await StudentCollection.findOne({ email });
        if (!student) {
            return res.render("forgot-password", { 
                error: "Email không tồn tại trong hệ thống" 
            });
        }

        // Trong thực tế, bạn sẽ gửi email kèm link reset password
        // Đây là giả lập cho mục đích demo
        res.render("forgot-password", { 
            success: "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn" 
        });
    } catch (error) {
        console.error("Error during forgot password:", error);
        res.render("forgot-password", { 
            error: "Đã xảy ra lỗi. Vui lòng thử lại."
        });
    }
});

app.get("/check-session", (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionData: req.session
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

async function createNotification(data) {
    try {
        const notification = new NotificationCollection(data);
        await notification.save();
        return notification;
    } catch (error) {
        console.error("Error creating notification:", error);
        return null;
    }
}

async function createActivityLog(userId, action, description, details = {}) {
    try {
        const log = new ActivityLogCollection({
            userId,
            action,
            description,
            details
        });
        await log.save();
        return log;
    } catch (error) {
        console.error("Error creating activity log:", error);
        return null;
    }
}

app.get("/api/notifications", async (req, res) => {
    try {
        // SỬA LỖI: Đổi từ user_id thành userId
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.userId; // SỬA LỖI: Đổi từ user_id thành userId
        const userRole = req.session.role || 'user';

        // Lấy thông báo dành cho user
        const notifications = await NotificationCollection.find({
            $or: [
                { isGlobal: true },
                { targetUsers: userId },
                { targetRole: userRole },
                { targetRole: 'all' }
            ],
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

        // Đánh dấu thông báo nào đã đọc
        const notificationsWithReadStatus = notifications.map(notification => ({
            ...notification,
            isRead: notification.readBy.some(read => read.userId.toString() === userId.toString())
        }));

        res.json({
            success: true,
            notifications: notificationsWithReadStatus,
            unreadCount: notificationsWithReadStatus.filter(n => !n.isRead).length
        });

    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/api/notifications/:id/read", async (req, res) => {
    try {
        // SỬA LỖI: Đổi từ user_id thành userId
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const notificationId = req.params.id;
        const userId = req.session.userId; // SỬA LỖI: Đổi từ user_id thành userId

        // Kiểm tra xem user đã đọc thông báo này chưa
        const notification = await NotificationCollection.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        const alreadyRead = notification.readBy.some(read => 
            read.userId.toString() === userId.toString()
        );

        if (!alreadyRead) {
            await NotificationCollection.findByIdAndUpdate(
                notificationId,
                {
                    $push: {
                        readBy: {
                            userId: userId,
                            readAt: new Date()
                        }
                    }
                }
            );
        }

        res.json({ success: true, message: "Notification marked as read" });

    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/admin/notifications", isAdmin, async (req, res) => {
    try {
        const { title, message, type, targetRole, isGlobal, priority, expiresAt } = req.body;
        
        const notification = await createNotification({
            title,
            message,
            type: type || 'info',
            targetRole: targetRole || 'all',
            isGlobal: isGlobal || false,
            priority: priority || 'normal',
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.session.userId // SỬA LỖI: Đổi từ user_id thành userId
        });

        if (notification) {
            res.json({ success: true, notification });
        } else {
            res.status(500).json({ error: "Failed to create notification" });
        }

    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/admin/approve-application", isAdmin, async (req, res) => {
    try {
        const { applicationId, action, rejectionReason } = req.body;
        const adminId = req.session.userId;

        console.log(`[ADMIN-APPROVE] Admin ${adminId} processing application ${applicationId} with action: ${action}`);

        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            console.log(`[ERROR] Application ${applicationId} not found`);
            return res.status(404).json({ 
                success: false, 
                message: "Không tìm thấy đơn đăng ký" 
            });
        }

        console.log(`[DEBUG] Found application:`, {
            id: application._id,
            studentId: application.studentId,
            status: application.status,
            roomNumber: application.roomNumber,
            fullName: application.fullName
        });

        if (application.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: `Đơn đăng ký đã được xử lý (${application.status})` 
            });
        }

        if (action === 'approve') {
            // ✅ THÊM MỚI: Kiểm tra sinh viên đã tồn tại trong toàn hệ thống chưa
            console.log(`[DEBUG] Checking if student already exists in system...`);
            
            const existingStudent = await checkStudentExistsInSystem(application.studentId, application.fullName);
            
            if (existingStudent.exists) {
                const location = existingStudent.location;
                const fieldType = existingStudent.type === 'studentId' ? 'Mã sinh viên' : 'Tên sinh viên';
                const fieldValue = existingStudent.type === 'studentId' ? application.studentId : application.fullName;
                
                console.log(`[ERROR] Student already exists:`, location);
                
                return res.status(400).json({ 
                    success: false, 
                    message: `${fieldType} "${fieldValue}" đã được đăng ký tại ${location.dormitoryName} - Tầng ${location.floorNumber} - Phòng ${location.roomNumber}. Không thể duyệt đơn đăng ký này!` 
                });
            }

            // ✅ THÊM MỚI: Kiểm tra phòng còn chỗ trống không
            const dormitory = await DormitoryCollection.findById(application.dormitoryId);
            if (!dormitory) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Không tìm thấy ký túc xá" 
                });
            }

            let targetRoom = null;
            let targetFloor = null;

            // Tìm phòng trong ký túc xá
            for (const floor of dormitory.floors) {
                const room = floor.rooms.find(r => r.roomNumber === application.roomNumber);
                if (room) {
                    targetRoom = room;
                    targetFloor = floor;
                    break;
                }
            }

            if (!targetRoom) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Không tìm thấy phòng ${application.roomNumber} trong ký túc xá` 
                });
            }

            // Kiểm tra phòng còn chỗ trống không
            const activeOccupants = targetRoom.occupants.filter(o => o.active);
            if (activeOccupants.length >= targetRoom.maxCapacity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Phòng ${application.roomNumber} đã đầy (${activeOccupants.length}/${targetRoom.maxCapacity}). Không thể duyệt đơn đăng ký!` 
                });
            }

            // ✅ Nếu tất cả kiểm tra đều pass, tiến hành duyệt đơn
            console.log(`[DEBUG] All validation passed, approving application...`);

            // Cập nhật trạng thái đơn đăng ký
            const updatedApplication = await PendingApplicationCollection.findByIdAndUpdate(
                applicationId, 
                {
                    status: 'approved',
                    approvedBy: adminId,
                    approvedAt: new Date(),
                    updatedAt: new Date()
                },
                { new: true }
            );

            console.log(`[DEBUG] Application updated:`, updatedApplication.status);

            // Tìm sinh viên trong database
            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (!student) {
                console.log(`[ERROR] Student not found for studentId: ${application.studentId}`);
                return res.status(404).json({ 
                    success: false, 
                    message: "Không tìm thấy sinh viên trong hệ thống" 
                });
            }

            console.log(`[DEBUG] Found student:`, {
                id: student._id,
                name: student.name,
                studentId: student.studentId
            });

            // Cập nhật thông tin phòng cho sinh viên
            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            // Thêm sinh viên vào phòng
            targetRoom.occupants.push({
                studentId: application.studentId,
                name: application.fullName,
                phone: application.phone || '',
                email: application.email || '',
                checkInDate: new Date(),
                active: true
            });

            // Đảm bảo totalFloors được cập nhật đúng
            if (!dormitory.details.totalFloors) {
                dormitory.details.totalFloors = dormitory.floors.length;
            }

            // Lưu thay đổi vào ký túc xá
            await dormitory.save();

            console.log(`[DEBUG] Student room assigned: ${application.roomNumber}`);

            // Gửi thông báo cho sinh viên
            const notificationResult = await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || dormitory.name,
                applicationId: applicationId
            });

            console.log(`[DEBUG] Notification result:`, notificationResult ? 'SUCCESS' : 'FAILED');

            // Tạo activity log
            await createActivityLog(student._id, 'application_approved', 
                `Đơn đăng ký phòng ${application.roomNumber} đã được duyệt`, {
                applicationId: applicationId,
                approvedBy: adminId
            });

            res.json({ 
                success: true, 
                message: "Đã duyệt đơn đăng ký thành công!",
                data: {
                    applicationId: applicationId,
                    studentName: student.name,
                    roomNumber: application.roomNumber,
                    dormitoryName: dormitory.name,
                    notificationSent: !!notificationResult
                }
            });

        } else if (action === 'reject') {
            // Từ chối đơn đăng ký
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected',
                rejectedBy: adminId,
                rejectedAt: new Date(),
                rejectionReason: rejectionReason || "Không đáp ứng yêu cầu",
                updatedAt: new Date()
            });

            const student = await StudentCollection.findOne({ studentId: application.studentId });
            if (student) {
                await sendNotificationOnEvent('registration_rejected', student._id, {
                    roomNumber: application.roomNumber,
                    reason: rejectionReason || "Không đáp ứng yêu cầu",
                    applicationId: applicationId
                });

                // Tạo activity log
                await createActivityLog(student._id, 'application_rejected', 
                    `Đơn đăng ký phòng ${application.roomNumber} đã bị từ chối`, {
                    applicationId: applicationId,
                    rejectedBy: adminId,
                    reason: rejectionReason
                });
            }

            res.json({ 
                success: true, 
                message: "Đã từ chối đơn đăng ký!" 
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: "Hành động không hợp lệ (phải là 'approve' hoặc 'reject')" 
            });
        }

    } catch (error) {
        console.error("[ERROR] Error processing application:", error);
        res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống khi xử lý đơn đăng ký",
            error: error.message
        });
    }
});


app.put("/api/admin/applications/:id/update-status", isAdmin, async (req, res) => {
    try {
        const { status, comments } = req.body;
        const applicationId = req.params.id;
        const adminId = req.session.userId;

        // Validate status
        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: "Trạng thái không hợp lệ" 
            });
        }

        // Find application
        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy đơn đăng ký" 
            });
        }

        // Find student
        const student = await StudentCollection.findOne({ studentId: application.studentId });
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy sinh viên" 
            });
        }

        if (status === 'approved') {
            // Update application
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'approved',
                approvedBy: adminId,
                approvedAt: new Date(),
                comments: comments || '',
                updatedAt: new Date()
            });

            // Assign room to student
            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            // Send notification
            await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || "KTX HUST",
                applicationId: applicationId
            });

            res.json({ 
                success: true, 
                message: "Đã duyệt đơn đăng ký thành công!"
            });

        } else if (status === 'rejected') {
            // Update application
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected',
                rejectedBy: adminId,
                rejectedAt: new Date(),
                rejectionReason: comments || "Không đáp ứng yêu cầu",
                comments: comments || '',
                updatedAt: new Date()
            });

            // Send notification
            await sendNotificationOnEvent('registration_rejected', student._id, {
                roomNumber: application.roomNumber,
                reason: comments || "Không đáp ứng yêu cầu",
                applicationId: applicationId
            });

            res.json({ 
                success: true, 
                message: "Đã từ chối đơn đăng ký!"
            });

        } else {
            // Just update comments for pending
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'pending',
                comments: comments || '',
                updatedAt: new Date()
            });

            res.json({ 
                success: true, 
                message: "Đã cập nhật trạng thái thành công!" 
            });
        }

    } catch (error) {
        console.error("Error updating application status:", error);
        res.status(500).json({ 
            success: false, 
            error: "Lỗi hệ thống khi cập nhật trạng thái"
        });
    }
});


async function sendNotificationOnEvent(eventType, userId, details = {}) {
    try {
        let notificationData = { createdBy: userId };

        switch (eventType) {
            case 'welcome':
                notificationData = {
                    ...notificationData,
                    title: 'Chào mừng đến với hệ thống KTX HUST!',
                    message: `Xin chào ${details.name}! Tài khoản của bạn đã được tạo thành công. Hãy khám phá các tính năng của hệ thống.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'register_success', 'Tạo tài khoản thành công', details);
                break;
                case 'registration_approved':
                    notificationData = {
                        ...notificationData,
                        title: 'Đơn đăng ký ký túc xá đã được duyệt!',
                        message: `Đơn đăng ký phòng ${details.roomNumber} tại ${details.dormitoryName} của bạn đã được admin phê duyệt. Vui lòng kiểm tra thông tin chi tiết trong hồ sơ cá nhân.`,
                        type: 'success',
                        targetUsers: [userId],
                        priority: 'high'
                    };
                    await createActivityLog(userId, 'registration_approved', 'Đơn đăng ký được duyệt', details);
                    break;
    
                case 'registration_rejected':
                    notificationData = {
                        ...notificationData,
                        title: 'Đơn đăng ký ký túc xá bị từ chối',
                        message: `Đơn đăng ký phòng ${details.roomNumber} của bạn đã bị từ chối. Lý do: ${details.reason}. Bạn có thể đăng ký lại phòng khác hoặc liên hệ ban quản lý để biết thêm chi tiết.`,
                        type: 'error',
                        targetUsers: [userId],
                        priority: 'high'
                    };
                    await createActivityLog(userId, 'registration_rejected', 'Đơn đăng ký bị từ chối', details);
                    break;

            case 'registration_success':
                notificationData = {
                    ...notificationData,
                    title: 'Đăng ký ký túc xá thành công',
                    message: `Bạn đã đăng ký ký túc xá thành công. Phòng: ${details.roomNumber || 'Chưa xác định'}, ${details.dormitoryName || ''}`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'register_success', 'Đăng ký ký túc xá thành công', details);
                break;

            case 'registration_failed':
                notificationData = {
                    ...notificationData,
                    title: 'Đăng ký ký túc xá thất bại',
                    message: `Đăng ký không thành công. Lý do: ${details.reason || 'Không xác định'}${details.roomNumber ? `. Phòng: ${details.roomNumber}` : ''}`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'register_failed', 'Đăng ký ký túc xá thất bại', details);
                break;

            case 'payment_success':
                notificationData = {
                    ...notificationData,
                    title: 'Thanh toán thành công',
                    message: `Thanh toán ${details.type || 'phí'} đã được xử lý thành công. Số tiền: ${details.amount || '0'} VND${details.transactionId ? `. Mã GD: ${details.transactionId}` : ''}`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'payment_success', 'Thanh toán thành công', details);
                break;

            case 'payment_failed':
                notificationData = {
                    ...notificationData,
                    title: 'Thanh toán thất bại',
                    message: `Giao dịch thanh toán không thành công${details.reason ? `. Lý do: ${details.reason}` : ''}. Vui lòng thử lại sau.`,
                    type: 'error',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'payment_failed', 'Thanh toán thất bại', details);
                break;

            case 'room_assigned':
                notificationData = {
                    ...notificationData,
                    title: 'Phân phòng thành công',
                    message: `Bạn đã được phân phòng ${details.roomNumber}${details.dormitoryName ? ` tại ${details.dormitoryName}` : ''}. Vui lòng xem thông tin chi tiết.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'room_assigned', 'Được phân phòng', details);
                break;

            case 'room_changed':
                notificationData = {
                    ...notificationData,
                    title: 'Chuyển phòng thành công',
                    message: `Bạn đã được chuyển từ phòng ${details.oldRoom} sang phòng ${details.newRoom}. Vui lòng cập nhật thông tin cá nhân.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'high'
                };
                await createActivityLog(userId, 'room_changed', 'Chuyển phòng', details);
                break;

            case 'profile_updated':
                notificationData = {
                    ...notificationData,
                    title: 'Cập nhật thông tin thành công',
                    message: `Thông tin cá nhân của bạn đã được cập nhật thành công.`,
                    type: 'success',
                    targetUsers: [userId],
                    priority: 'low'
                };
                await createActivityLog(userId, 'profile_updated', 'Cập nhật thông tin cá nhân', details);
                break;

            case 'password_changed':
                notificationData = {
                    ...notificationData,
                    title: 'Thay đổi mật khẩu thành công',
                    message: `Mật khẩu của bạn đã được thay đổi thành công vào lúc ${new Date().toLocaleString('vi-VN')}.`,
                    type: 'info',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                await createActivityLog(userId, 'password_changed', 'Thay đổi mật khẩu', details);
                break;

            case 'maintenance_notice':
                notificationData = {
                    ...notificationData,
                    title: 'Thông báo bảo trì hệ thống',
                    message: details.message || 'Hệ thống sẽ được bảo trì trong thời gian tới. Vui lòng theo dõi thông báo.',
                    type: 'warning',
                    isGlobal: true,
                    targetRole: 'all',
                    priority: 'normal'
                };
                break;

            case 'announcement':
                notificationData = {
                    ...notificationData,
                    title: details.title || 'Thông báo từ Ban Quản lý',
                    message: details.message,
                    type: details.type || 'info',
                    isGlobal: true,
                    targetRole: details.targetRole || 'all',
                    priority: details.priority || 'normal'
                };
                break;

            case 'reminder':
                notificationData = {
                    ...notificationData,
                    title: details.title || 'Nhắc nhở',
                    message: details.message,
                    type: 'warning',
                    targetUsers: [userId],
                    priority: 'normal'
                };
                break;

            default:
                console.log(`Unknown notification event type: ${eventType}`);
                return null;
        }

        const notification = await createNotification(notificationData);
        return notification;

    } catch (error) {
        console.error("Error sending notification:", error);
        return null;
    }
}

app.get("/admin/applications", isAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const applications = await ApplicationCollection
            .find(query)
            .populate('userId', 'name studentId email phone')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await ApplicationCollection.countDocuments(query);

        res.json({
            success: true,
            applications,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).json({ 
            success: false, 
            message: "Lỗi khi lấy danh sách đơn đăng ký" 
        });
    }
});

app.get("/admin/applications/stats", isAdmin, async (req, res) => {
    try {
        const stats = await ApplicationCollection.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
        };

        stats.forEach(stat => {
            result[stat._id] = stat.count;
            result.total += stat.count;
        });

        res.json({ success: true, stats: result });

    } catch (error) {
        console.error("Error fetching application stats:", error);
        res.status(500).json({ 
            success: false, 
            message: "Lỗi khi lấy thống kê đơn đăng ký" 
        });
    }
});

global.sendNotificationOnEvent = sendNotificationOnEvent;
global.createActivityLog = createActivityLog;

app.post("/register-room", isAuthenticated, async (req, res) => {
    try {
        const { dormitoryId, roomNumber, preferences } = req.body;
        const userId = req.session.userId;

        // Logic đăng ký phòng (giả lập)
        const success = Math.random() > 0.3; // 70% thành công

        if (success) {
            // Cập nhật thông tin sinh viên
            await StudentCollection.findByIdAndUpdate(userId, {
                dormitoryId: dormitoryId,
                roomNumber: roomNumber
            });

            // ✨ Tạo thông báo thành công
            await sendNotificationOnEvent('registration_success', userId, {
                roomNumber: roomNumber,
                dormitoryName: "KTX Trung tâm" // Lấy từ database
            });

            res.json({ 
                success: true, 
                message: "Đăng ký phòng thành công!",
                roomNumber: roomNumber 
            });
        } else {
            // ✨ Tạo thông báo thất bại
            await sendNotificationOnEvent('registration_failed', userId, {
                reason: "Phòng đã đầy",
                roomNumber: roomNumber
            });

            res.json({ 
                success: false, 
                message: "Đăng ký thất bại - Phòng đã đầy!" 
            });
        }

    } catch (error) {
        console.error("Error registering room:", error);
        
        // ✨ Tạo thông báo lỗi hệ thống
        await sendNotificationOnEvent('registration_failed', req.session.userId, {
            reason: "Lỗi hệ thống"
        });

        res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống" 
        });
    }
});

app.post("/admin/send-announcement", isAdmin, async (req, res) => {
    try {
        const { title, message, type, targetRole, priority } = req.body;
        
        const notification = await createNotification({
            title: title,
            message: message,
            type: type || 'info',
            isGlobal: true,
            targetRole: targetRole || 'all',
            priority: priority || 'normal',
            createdBy: req.session.userId
        });
        
        res.json({ 
            success: true, 
            message: "Đã gửi thông báo thành công!",
            notificationId: notification._id 
        });
        
    } catch (error) {
        console.error("Error sending announcement:", error);
        res.status(500).json({ error: "Không thể gửi thông báo" });
    }
});

app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.userId;
        
        // Tìm tất cả thông báo chưa đọc của user
        const unreadNotifications = await NotificationCollection.find({
            $or: [
                { isGlobal: true },
                { targetUsers: userId },
                { targetRole: req.session.role || 'user' },
                { targetRole: 'all' }
            ],
            'readBy.userId': { $ne: userId }
        });

        // Đánh dấu tất cả đã đọc
        const updatePromises = unreadNotifications.map(notification => 
            NotificationCollection.findByIdAndUpdate(
                notification._id,
                {
                    $push: {
                        readBy: {
                            userId: userId,
                            readAt: new Date()
                        }
                    }
                }
            )
        );

        await Promise.all(updatePromises);

        res.json({ 
            success: true, 
            message: `Đã đánh dấu ${unreadNotifications.length} thông báo là đã đọc` 
        });

    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
