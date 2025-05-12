const express = require("express");
const path = require("path");
const { StudentCollection, DormitoryCollection, PendingApplicationCollection } = require('./config');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');
const dormitoryRoutes = require('./dormitory-routes');
const registrationRoutes = require('./registration-routes');
const adminApplicationRoutes = require('./admin-application-routes');

app.use(session({
    secret: 'your-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 // 1 ngày
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
        // Nếu đã đăng nhập, hiển thị home.ejs
        res.render("home");
    } else {
        // Nếu chưa đăng nhập, hiển thị startuphome.ejs
        res.render("startuphome");
    }
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

// Route xử lý đăng ký
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

        // Nếu chọn ghi nhớ đăng nhập, kéo dài thời gian session
        if (remember) {
            req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 ngày
        }

        // Chuyển hướng dựa vào vai trò
        if (student.role === "admin") {
            return res.redirect("/admin/dormitories");
        } else {
            return res.redirect("/");
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.render("login", { 
            error: "Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại."
        });
    }
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

const port = 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});