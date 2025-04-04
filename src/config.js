const mongoose = require('mongoose');
const connect = mongoose.connect("mongodb://0.0.0.0:27017/Dormitory");

connect.then(() => {
    console.log("Database Connected Successfully");
})
.catch(() => {
    console.log("Database cannot be Connected");
})

// Schema cho thông tin đăng nhập
const Loginschema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
});
// Model cho thông tin đăng nhập
const UserCollection = mongoose.model("users", Loginschema);


module.exports = UserCollection;