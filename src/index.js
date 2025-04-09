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
    name: 'dormitory_session'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Use EJS as the view engine
app.set("view engine", "ejs");

// API routes
app.use('/api', dormitoryRoutes);

// Middleware to add user info to all views
app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null
    };
    next();
});

// Home page
app.get("/", (req, res) => {
    res.render("startuphome");
});

// Login page
app.get("/login", (req, res) => {
    res.render("login");
});

// Signup page
app.get("/signup", (req, res) => {
    res.render("signup");
});

// Create default admin account
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
            
            console.log('Default admin account created');
        }
    } catch (error) {
        console.error('Error creating admin account:', error);
    }
}

// Call create admin function
createDefaultAdmin();

// Map page
app.get("/map", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.render("map", { dormitories: JSON.stringify(dormitories) });
    } catch (error) {
        console.error("Error fetching dormitories for map:", error);
        res.render("map", { dormitories: "[]" });
    }
});

// Admin dormitories list
app.get("/admin/dormitories", async (req, res) => {
    // Check admin rights
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
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

// Add dormitory page
app.get("/admin/dormitories/add", (req, res) => {
    // Check admin rights
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
    res.render("admin-dormitory-form", { 
        action: "add",
        dormitory: null,
        user: { name: req.session.name, role: req.session.role }
    });
});

// Edit dormitory page
app.get("/admin/dormitories/edit/:id", async (req, res) => {
    // Check admin rights
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
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

// View dormitory details with rooms
app.get("/admin/dormitories/view/:id", async (req, res) => {
    // Check admin rights
    if (req.session.role !== 'admin') {
        return res.redirect('/login');
    }
    
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

// API for featured dormitories
app.get("/api/featured-dormitories", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find().limit(5);
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching featured dormitories:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu ký túc xá nổi bật" });
    }
});

// Signup process
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

// Login process
app.post("/home", async (req, res) => {
    try {
        const user = await UserCollection.findOne({ name: req.body.username });
        if (!user) {
            return res.send("Tên người dùng không tồn tại");
        }

        const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
        if (isPasswordValid) {
            req.session.name = user.name;
            req.session.role = user.role;

            // Redirect based on role
            if (user.role === "admin") {
                return res.redirect("/admin/dormitories");
            }

            return res.render("home", { data: user });
        }

        res.send("Tên người dùng hoặc mật khẩu không đúng");
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal server error.");
    }
});

// API for map data
app.get("/api/map-data", async (req, res) => {
    try {
        const dormitories = await DormitoryCollection.find();
        res.json(dormitories);
    } catch (error) {
        console.error("Error fetching map data:", error);
        res.status(500).json({ error: "Không thể lấy dữ liệu bản đồ" });
    }
});

// Check session endpoint
app.get('/check-session', (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionData: req.session
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Start server
const port = 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});