const express = require("express");
const path = require("path");
const UserCollection = require('./config');
const collection = UserCollection; 
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const app = express();
const session = require('express-session');


app.use(session({
    secret: 'your-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false } 
}));

app.use(express.json());

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
//use EJS as the view engine
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("startuphome");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const data = {
        name: req.body.username,
        phone: req.body.phone,
        password: req.body.password,
    };

    const existingUser = await collection.findOne({ name: data.name });

    if (existingUser) {
        res.send('User already exists. Please choose a different username.');
    } else {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword;
        const userdata = await collection.create(data);
        console.log(userdata);
        res.render('home', { data });
    }
});



app.post("/home", async (req, res) => {
    try {
        const user = await collection.findOne({ name: req.body.username });
        if (!user) {
            return res.send("Tên người dùng không tồn tại");
        }

        const isPasswordValid = await bcrypt.compare(req.body.password, user.password);
        if (isPasswordValid) {
            req.session.name = user.name; // Lưu tên người dùng vào session

            // Kiểm tra nếu là admin
            if (user.role === "admin") {
                return res.redirect("/admin"); // Chuyển hướng đến trang admin
            }

            return res.render("home", { data: user }); // Chuyển đến trang home cho user thường
        }

        res.send("Tên người dùng hoặc mật khẩu không đúng");
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal server error.");
    }
});


const port = 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
});