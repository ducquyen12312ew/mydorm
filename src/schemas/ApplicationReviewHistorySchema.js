/**
 * ApplicationReviewHistory Schema
 * Lưu lịch sử duyệt/từ chối đơn đăng ký
 */

const mongoose = require('mongoose');

const ApplicationReviewHistorySchema = new mongoose.Schema({
    applicationId: mongoose.Schema.Types.ObjectId,
    studentId: String,
    studentName: String,
    
    action: {
        type: String,
        enum: ['approved', 'rejected', 'pending']
    },
    
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    reviewedByName: String,
    reviewedByEmail: String,
    
    reason: String,  // Lý do duyệt hoặc từ chối
    comments: String,
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'applicationreviewhistory' });

ApplicationReviewHistorySchema.index({ applicationId: 1, createdAt: -1 });
ApplicationReviewHistorySchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('ApplicationReviewHistory', ApplicationReviewHistorySchema);
