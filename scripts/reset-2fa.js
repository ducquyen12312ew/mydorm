// Script to reset 2FA for stuck accounts
const mongoose = require('mongoose');
const readline = require('readline');

// Load config
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TwoFactorSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    totpSecret: String,
    totpEnabled: { type: Boolean, default: false },
    smsOtpEnabled: { type: Boolean, default: false },
    emailOtpEnabled: { type: Boolean, default: false },
    backupCodes: [{
        code: String,
        used: { type: Boolean, default: false }
    }],
    otpAttempts: { type: Number, default: 0 },
    otpLockedUntil: Date
}, { timestamps: true });

const TwoFactor = mongoose.model('TwoFactor', TwoFactorSchema);

const StudentSchema = new mongoose.Schema({
    username: String,
    name: String,
    email: String
});

const Student = mongoose.model('Student', StudentSchema);

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Dormitory');
        
        console.log('✅ Connected to MongoDB');
        
        // Find all accounts with 2FA enabled
        const twoFactorAccounts = await TwoFactor.find({ totpEnabled: true });
        
        if (twoFactorAccounts.length === 0) {
            console.log('ℹ️  Không có tài khoản nào bật 2FA');
            await mongoose.disconnect();
            process.exit(0);
        }
        
        console.log(`\n🔍 Tìm thấy ${twoFactorAccounts.length} tài khoản đã bật 2FA:\n`);
        
        // Show accounts
        for (const tfa of twoFactorAccounts) {
            const student = await Student.findById(tfa.userId);
            if (student) {
                console.log(`   - ${student.username} (${student.name}) - Email: ${student.email || 'N/A'}`);
            }
        }
        
        console.log('\n⚠️  CẢNH BÁO: Script này sẽ TẮT 2FA cho TẤT CẢ các tài khoản trên\n');
        
        rl.question('Bạn có chắc chắn muốn tiếp tục? (yes/no): ', async (answer) => {
            if (answer.toLowerCase() === 'yes') {
                console.log('\n🔄 Đang reset 2FA...\n');
                
                // Reset all 2FA
                const result = await TwoFactor.updateMany(
                    { totpEnabled: true },
                    { 
                        $set: { 
                            totpEnabled: false,
                            smsOtpEnabled: false,
                            emailOtpEnabled: false,
                            totpSecret: null,
                            backupCodes: [],
                            otpAttempts: 0,
                            otpLockedUntil: null
                        }
                    }
                );
                
                console.log(`✅ Đã reset 2FA cho ${result.modifiedCount} tài khoản`);
                console.log('ℹ️  Các tài khoản giờ có thể đăng nhập bình thường và bật lại 2FA mới\n');
            } else {
                console.log('\n❌ Đã hủy thao tác\n');
            }
            
            await mongoose.disconnect();
            rl.close();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

main();
