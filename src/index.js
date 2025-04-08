const express = require("express");
const path = require("path");
const { UserCollection, DormitoryCollection } = require('./config');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');
const dormitoryRoutes = require('./dormitory-routes');

app.use(session({
    secret: 'your-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false },
    name: 'dormitory_session' // Thêm tên cụ thể cho cookie
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use('/api', dormitoryRoutes);

//use EJS as the view engine
app.set("view engine", "ejs");

// Sử dụng routes cho ký túc xá
app.use('/api', dormitoryRoutes);

// Middleware để lưu thông tin user vào res.locals
app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null
    };
    next();
});

app.get("/", (req, res) => {
    res.render("startuphome");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});
// Thêm tài khoản admin mặc định nếu chưa tồn tại
async function createDefaultAdmin() {
    try {
      const adminExists = await UserCollection.findOne({ role: 'admin' });
      if (!adminExists) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash('admin123', saltRounds);
        
        await UserCollection.create({
          name: 'admin',
          password: hashedPassword,
          role: 'admin'
        });
        
        console.log('Tài khoản admin mặc định đã được tạo');
      }
    } catch (error) {
      console.error('Lỗi khi tạo tài khoản admin:', error);
    }
  }
  
  // Gọi hàm tạo admin
  createDefaultAdmin();

app.get("/map", async (req, res) => {
    try {
        // Lấy tất cả ký túc xá từ database
        const dormitories = await DormitoryCollection.find();
        res.render("map", { dormitories: JSON.stringify(dormitories) });
    } catch (error) {
        console.error("Error fetching dormitories for map:", error);
        res.render("map", { dormitories: "[]" });
    }
});

app.get("/admin/dormitories", async (req, res) => {
    // Kiểm tra quyền admin
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
    try {
        const dormitories = await DormitoryCollection.find();
        res.render("admin-dormitories", { dormitories });
    } catch (error) {
        console.error("Error fetching dormitories:", error);
        res.render("admin-dormitories", { dormitories: [], error: "Không thể lấy dữ liệu ký túc xá" });
    }
});

app.get("/admin/dormitories/add", (req, res) => {
    // Kiểm tra quyền admin
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
    res.render("admin-dormitory-form", { dormitory: null, action: "add" });
});

app.get("/admin/dormitories/edit/:id", async (req, res) => {
    // Kiểm tra quyền admin
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
    try {
        const dormitory = await DormitoryCollection.findById(req.params.id);
        if (!dormitory) {
            return res.redirect('/admin/dormitories');
        }
        res.render("admin-dormitory-form", { dormitory, action: "edit" });
    } catch (error) {
        console.error("Error fetching dormitory for edit:", error);
        res.redirect('/admin/dormitories');
    }
});
// API để lấy dữ liệu ký túc xá nổi bật cho slideshow
app.get("/api/featured-dormitories", async (req, res) => {
    try {
        // Lấy tối đa 5 ký túc xá nổi bật
        const dormitories = await DormitoryCollection.find().limit(5);
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching featured dormitories:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu ký túc xá nổi bật" });
    }
});
app.post("/signup", async (req, res) => {
    const data = {
        name: req.body.username,
        phone: req.body.phone,
        password: req.body.password,
    };

    const existingUser = await UserCollection.findOne({ name: data.name });

    if (existingUser) {
        res.send('User already exists. Please choose a different username.');
    } else {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword;
        const userdata = await UserCollection.create(data);
        console.log(userdata);
        res.render('home', { data });
    }
});

app.post("/home", async (req, res) => {
    try {
        const user = await UserCollection.findOne({ name: req.body.username });
        if (!user) {
            return res.send("Tên người dùng không tồn tại");
        }

        const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
        if (isPasswordValid) {
            req.session.name = user.name; // Lưu tên người dùng vào session
            req.session.role = user.role; // Lưu vai trò người dùng vào session

            // Kiểm tra nếu là admin
            if (user.role === "admin") {
                return res.redirect("/admin/dormitories"); // Chuyển hướng đến trang admin
            }

            return res.render("home", { data: user }); // Chuyển đến trang home cho user thường
        }

        res.send("Tên người dùng hoặc mật khẩu không đúng");
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal server error.");
    }
});

// API endpoint để lấy tất cả ký túc xá cho bản đồ
app.get("/api/map-data", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching map data:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu bản đồ" });
    }
});

app.get('/check-session', (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionData: req.session
    });
});
const port = 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});