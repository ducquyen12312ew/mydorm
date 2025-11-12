const express = require("express");
const path = require("path");
const { StudentCollection, DormitoryCollection, PendingApplicationCollection, NotificationCollection, ActivityLogCollection } = require('./src/config/config');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');

// Routes
const dormitoryRoutes = require('./src/routes/dormitory-routes');
const registrationRoutes = require('./src/routes/student/registration-routes');
const adminApplicationRoutes = require('./src/routes/admin/admin-application-routes');
const roomStatusRoutes = require('./src/routes/student/room-status-routes');
const dashboardRoutes = require('./src/routes/admin/dashboard-routes');

// Session configuration
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(dashboardRoutes);

app.set("view engine", "ejs");

// API routes
app.use('/api', registrationRoutes);
app.use('/api', dormitoryRoutes);
app.use('/api', adminApplicationRoutes);
app.use('/', roomStatusRoutes);

// User info middleware
app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null,
        id: req.session.userId || null
    };
    next();
});

// ============================================
// MIDDLEWARE
// ============================================

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

// ============================================
// PUBLIC ROUTES
// ============================================

app.get("/", (req, res) => {
    if (req.session && req.session.userId) {
        if (req.session.role === 'admin') {
            res.redirect('/admin/dormitories');
        } else {
            res.render("student/home", {
                user: { 
                    name: req.session.name, 
                    role: req.session.role,
                    id: req.session.userId
                }
            });
        }
    } else {
        res.render("public/startuphome");
    }
});

app.get("/home", isAuthenticated, (req, res) => {
    if (req.session.role === 'admin') {
        return res.redirect('/admin/dormitories');
    }
    res.render("student/home", {
        user: { 
            name: req.session.name, 
            role: req.session.role,
            id: req.session.userId
        }
    });
});

app.get("/map", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.render("public/map", { dormitories: JSON.stringify(dormitories) });
    } catch (error) {
        console.error("Error fetching dormitories for map:", error);
        res.render("public/map", { dormitories: "[]" });
    }
});

// ============================================
// AUTH ROUTES
// ============================================

app.get("/login", (req, res) => {
    res.render("auth/login");
});

app.get("/signup", (req, res) => {
    res.render("auth/signup");
});

app.get("/forgot-password", (req, res) => {
    res.render("auth/forgot-password");
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

        const existingUser = await StudentCollection.findOne({ username });
        if (existingUser) {
            return res.render("auth/signup", { 
                error: "Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác." 
            });
        }

        if (email) {
            const existingEmail = await StudentCollection.findOne({ email });
            if (existingEmail) {
                return res.render("auth/signup", { 
                    error: "Email đã được sử dụng. Vui lòng sử dụng email khác." 
                });
            }
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

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

        req.session.userId = newStudent._id;
        req.session.name = newStudent.name;
        req.session.role = newStudent.role;

        await sendNotificationOnEvent('welcome', newStudent._id, {
            name: newStudent.name
        });

        res.redirect('/');
    } catch (error) {
        console.error("Error during signup:", error);
        res.render("auth/signup", { 
            error: "Đã xảy ra lỗi trong quá trình đăng ký. Vui lòng thử lại."
        });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { username, password, remember } = req.body;

        const student = await StudentCollection.findOne({ username });
        if (!student) {
            return res.render("auth/login", { 
                error: "Tên đăng nhập hoặc mật khẩu không đúng" 
            });
        }

        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            return res.render("auth/login", { 
                error: "Tên đăng nhập hoặc mật khẩu không đúng" 
            });
        }

        req.session.userId = student._id;
        req.session.name = student.name;
        req.session.role = student.role;
        req.session.studentId = student.studentId;
        
        if (remember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 ngày
        }

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.render("auth/login", { 
                    error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
                });
            }

            if (student.role === "admin") {
                return res.redirect("/admin/dormitories");
            } else {
                return res.redirect("/");
            }
        });

    } catch (error) {
        console.error("Error during login:", error);
        res.render("auth/login", { 
            error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
        });
    }
});

app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        const student = await StudentCollection.findOne({ email });
        if (!student) {
            return res.render("auth/forgot-password", { 
                error: "Email không tồn tại trong hệ thống" 
            });
        }

        res.render("auth/forgot-password", { 
            success: "Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn" 
        });
    } catch (error) {
        console.error("Error during forgot password:", error);
        res.render("auth/forgot-password", { 
            error: "Đã xảy ra lỗi. Vui lòng thử lại."
        });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// ============================================
// STUDENT ROUTES
// ============================================

app.get("/register", isAuthenticated, (req, res) => {
    res.render("student/register");
});

app.get("/profile", isAuthenticated, async (req, res) => {
    try {
        const success = req.query.success;
        const error = req.query.error;
        
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
        
        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }
        
        let dormitory = null;
        let room = null;
        if (student.dormitoryId) {
            dormitory = await DormitoryCollection.findById(student.dormitoryId);
            
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
        
        const applications = await PendingApplicationCollection.find({
            studentId: student.studentId
        }).sort({ createdAt: -1 }).limit(5);
        
        res.render("student/profile", {
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

app.post('/update-profile', isAuthenticated, async (req, res) => {
    try {
        const {
            name,
            studentId,
            email,
            phone,
            faculty,
            academicYear,
            gender
        } = req.body;

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        if (name && name !== student.name) {
            req.session.name = name;
        }

        if (email && email !== student.email) {
            const existingEmail = await StudentCollection.findOne({ email, _id: { $ne: req.session.userId } });
            if (existingEmail) {
                return res.redirect('/profile?error=email_exists');
            }
        }

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

app.post('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.redirect('/profile?error=passwords_dont_match');
        }

        const student = await StudentCollection.findById(req.session.userId);
        if (!student) {
            return res.redirect('/login');
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
        if (!isPasswordValid) {
            return res.redirect('/profile?error=incorrect_password');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await StudentCollection.findByIdAndUpdate(req.session.userId, {
            password: hashedPassword
        });

        res.redirect('/profile?success=password_changed');
    } catch (error) {
        console.error('Error changing password:', error);
        res.redirect('/profile?error=password_change_failed');
    }
});

app.post("/register-room", isAuthenticated, async (req, res) => {
    try {
        const { dormitoryId, roomNumber, preferences } = req.body;
        const userId = req.session.userId;

        const success = Math.random() > 0.3; // 70% thành công

        if (success) {
            await StudentCollection.findByIdAndUpdate(userId, {
                dormitoryId: dormitoryId,
                roomNumber: roomNumber
            });

            await sendNotificationOnEvent('registration_success', userId, {
                roomNumber: roomNumber,
                dormitoryName: "KTX Trung tâm"
            });

            res.json({ 
                success: true, 
                message: "Đăng ký phòng thành công!",
                roomNumber: roomNumber 
            });
        } else {
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
        
        await sendNotificationOnEvent('registration_failed', req.session.userId, {
            reason: "Lỗi hệ thống"
        });

        res.status(500).json({ 
            success: false, 
            message: "Lỗi hệ thống" 
        });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get("/admin/dashboard", isAdmin, (req, res) => {
    res.render("admin/dashboard", { 
        user: { 
            name: req.session.name, 
            role: req.session.role 
        } 
    });
});

app.get("/admin/logs", isAdmin, (req, res) => {
    res.render("admin/logs", { 
        user: { 
            name: req.session.name, 
            role: req.session.role 
        } 
    });
});

app.get("/admin/dormitories", isAdmin, async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.render("admin/dormitory/admin-dormitories", { 
            dormitories, 
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error fetching dormitories:", error);
        res.render("admin/dormitory/admin-dormitories", { 
            dormitories: [], 
            error: "Không thể lấy dữ liệu ký túc xá",
            user: { name: req.session.name, role: req.session.role }
        });
    }
});

app.get("/admin/application", isAdmin, async (req, res) => {
    try {
        res.render("admin/application/admin-application", { 
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error rendering application page:", error);
        res.status(500).send("Internal server error");
    }
});

app.get("/admin/application/:id", isAdmin, async (req, res) => {
    try {
        res.render("admin/application/admin-application-detail", { 
            applicationId: req.params.id,
            user: { name: req.session.name, role: req.session.role } 
        });
    } catch (error) {
        console.error("Error rendering application detail page:", error);
        res.status(500).send("Internal server error");
    }
});

app.get("/admin/dormitories/add", isAdmin, (req, res) => {
    res.render("admin/dormitory/admin-dormitory-form", { 
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
        res.render("admin/dormitory/admin-dormitory-form", { 
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
        res.render("admin/dormitory/admin-dormitory-view", { 
            dormitory,
            user: { name: req.session.name, role: req.session.role }
        });
    } catch (error) {
        console.error("Error fetching dormitory details:", error);
        res.redirect('/admin/dormitories');
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

            const dormitory = await DormitoryCollection.findById(application.dormitoryId);
            if (!dormitory) {
                return res.status(404).json({ 
                    success: false, 
                    message: "Không tìm thấy ký túc xá" 
                });
            }

            let targetRoom = null;
            let targetFloor = null;

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

            const activeOccupants = targetRoom.occupants.filter(o => o.active);
            if (activeOccupants.length >= targetRoom.maxCapacity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Phòng ${application.roomNumber} đã đầy (${activeOccupants.length}/${targetRoom.maxCapacity}). Không thể duyệt đơn đăng ký!` 
                });
            }

            console.log(`[DEBUG] All validation passed, approving application...`);

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

            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

            targetRoom.occupants.push({
                studentId: application.studentId,
                name: application.fullName,
                phone: application.phone || '',
                email: application.email || '',
                checkInDate: new Date(),
                active: true
            });

            if (!dormitory.details.totalFloors) {
                dormitory.details.totalFloors = dormitory.floors.length;
            }

            await dormitory.save();

            console.log(`[DEBUG] Student room assigned: ${application.roomNumber}`);

            const notificationResult = await sendNotificationOnEvent('registration_approved', student._id, {
                roomNumber: application.roomNumber,
                dormitoryName: application.dormitoryName || dormitory.name,
                applicationId: applicationId
            });

            console.log(`[DEBUG] Notification result:`, notificationResult ? 'SUCCESS' : 'FAILED');

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

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: "Trạng thái không hợp lệ" 
            });
        }

        const application = await PendingApplicationCollection.findById(applicationId);
        if (!application) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy đơn đăng ký" 
            });
        }

        const student = await StudentCollection.findOne({ studentId: application.studentId });
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                error: "Không tìm thấy sinh viên" 
            });
        }

        if (status === 'approved') {
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'approved',
                approvedBy: adminId,
                approvedAt: new Date(),
                comments: comments || '',
                updatedAt: new Date()
            });

            await StudentCollection.findByIdAndUpdate(student._id, {
                dormitoryId: application.dormitoryId,
                roomNumber: application.roomNumber,
                updatedAt: new Date()
            });

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
            await PendingApplicationCollection.findByIdAndUpdate(applicationId, {
                status: 'rejected',
                rejectedBy: adminId,
                rejectedAt: new Date(),
                rejectionReason: comments || "Không đáp ứng yêu cầu",
                comments: comments || '',
                updatedAt: new Date()
            });

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

app.get("/admin/applications", isAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const applications = await PendingApplicationCollection
            .find(query)
            .populate('userId', 'name studentId email phone')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await PendingApplicationCollection.countDocuments(query);

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
        const stats = await PendingApplicationCollection.aggregate([
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

// ============================================
// API ROUTES
// ============================================

app.get("/api/featured-dormitories", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find().limit(5);
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching featured dormitories:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu ký túc xá nổi bật" });
    }
});

app.get("/api/notifications", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.userId;
        const userRole = req.session.role || 'user';

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
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const notificationId = req.params.id;
        const userId = req.session.userId;

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

app.post("/api/notifications/mark-all-read", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = req.session.userId;
        
        const unreadNotifications = await NotificationCollection.find({
            $or: [
                { isGlobal: true },
                { targetUsers: userId },
                { targetRole: req.session.role || 'user' },
                { targetRole: 'all' }
            ],
            'readBy.userId': { $ne: userId }
        });

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
            createdBy: req.session.userId
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

// ============================================
// DEBUG ROUTES
// ============================================

app.use('/debug-session', (req, res) => {
    res.json({
        sessionData: req.session,
        hasUserId: !!req.session.userId,
        role: req.session.role,
        name: req.session.name
    });
});

app.get("/check-session", (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionData: req.session
    });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

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

async function checkStudentExistsInSystem(studentId, fullName) {
    try {
        const dormitories = await DormitoryCollection.find({});
        
        for (const dorm of dormitories) {
            for (const floor of dorm.floors) {
                for (const room of floor.rooms) {
                    const occupant = room.occupants.find(o => 
                        o.active && 
                        (o.studentId === studentId || o.name === fullName)
                    );
                    
                    if (occupant) {
                        return {
                            exists: true,
                            type: occupant.studentId === studentId ? 'studentId' : 'name',
                            location: {
                                dormitoryName: dorm.name,
                                floorNumber: floor.floorNumber,
                                roomNumber: room.roomNumber
                            }
                        };
                    }
                }
            }
        }
        
        return { exists: false };
    } catch (error) {
        console.error('Error checking student exists:', error);
        return { exists: false };
    }
}

// ============================================
// CREATE DEFAULT ADMIN
// ============================================

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
            
            console.log('✓ Default admin account created');
        }
    } catch (error) {
        console.error('Error creating admin account:', error);
    }
}

createDefaultAdmin();

// ============================================
// GLOBAL FUNCTIONS
// ============================================

global.sendNotificationOnEvent = sendNotificationOnEvent;
global.createActivityLog = createActivityLog;

// ============================================
// START SERVER
// ============================================

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log('Server listening on port ' + port);
});