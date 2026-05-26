// src/utils/labels.js
// Labels cho Violations
const VIOLATION_TYPE_LABELS = {
    noise: '🔊 Ồn ào',
    alcohol: '🍺 Rượu bia',
    smoking: '🚬 Hút thuốc',
    late_return: '🕐 Về muộn',
    unauthorized_guest: '👥 Khách không phép',
    damage: '🔨 Hư hỏng tài sản',
    hygiene: '🧹 Vi phạm vệ sinh',
    theft: '💰 Trộm cắp',
    violence: '⚔️ Bạo lực',
    other: '📝 Khác'
};

const VIOLATION_SEVERITY_LABELS = {
    'cảnh cáo': '⚠️ Cảnh cáo',
    'kiểm điểm': '⛔ Kiểm điểm',
    'kỷ luật': '🚫 Kỷ luật'
};

const VIOLATION_STATUS_LABELS = {
    'chưa xử lý': '⏳ Chưa xử lý',
    'đã xử lý': '✅ Đã xử lý'
};

// Labels cho Maintenance Requests
const MAINTENANCE_TYPE_LABELS = {
    electrical: '🔌 Điện',
    plumbing: '🚰 Nước',
    hvac: '❄️ Điều hòa',
    furniture: '🪑 Đồ nội thất',
    door_lock: '🔐 Khóa cửa',
    window: '🪟 Cửa sổ',
    internet: '📡 Internet',
    cleaning: '🧹 Vệ sinh',
    pest_control: '🐛 Kiểm soát côn trùng',
    other: '📝 Khác'
};

const MAINTENANCE_PRIORITY_LABELS = {
    'thấp': '🟢 Thấp',
    'bình thường': '🟡 Bình thường',
    'cao': '🟠 Cao',
    'khẩn cấp': '🔴 Khẩn cấp'
};

const MAINTENANCE_STATUS_LABELS = {
    'chưa xử lý': '⏳ Chưa xử lý',
    'đang xử lý': '⚙️ Đang xử lý',
    'hoàn thành': '✅ Hoàn thành',
    'hủy': '❌ Hủy'
};

// Helper functions
function getViolationTypeLabel(type) {
    return VIOLATION_TYPE_LABELS[type] || type;
}

function getViolationSeverityLabel(severity) {
    return VIOLATION_SEVERITY_LABELS[severity] || severity;
}

function getViolationStatusLabel(status) {
    return VIOLATION_STATUS_LABELS[status] || status;
}

function getMaintenanceTypeLabel(type) {
    return MAINTENANCE_TYPE_LABELS[type] || type;
}

function getMaintenancePriorityLabel(priority) {
    return MAINTENANCE_PRIORITY_LABELS[priority] || priority;
}

function getMaintenanceStatusLabel(status) {
    return MAINTENANCE_STATUS_LABELS[status] || status;
}

// Priority scoring (cao hơn = ưu tiên hơn)
const PRIORITY_SCORES = {
    'khẩn cấp': 4,
    'cao': 3,
    'bình thường': 2,
    'thấp': 1
};

function getPriorityScore(priority) {
    return PRIORITY_SCORES[priority] || 0;
}

// Severity scoring (cao hơn = nghiêm trọng hơn)
const SEVERITY_SCORES = {
    'kỷ luật': 3,
    'kiểm điểm': 2,
    'cảnh cáo': 1
};

function getSeverityScore(severity) {
    return SEVERITY_SCORES[severity] || 0;
}

// Format date to Vietnamese
function formatDateVN(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Calculate days between dates
function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Get status badge color
function getStatusBadgeColor(status) {
    const colors = {
        'chưa xử lý': 'warning',
        'đang xử lý': 'info',
        'hoàn thành': 'success',
        'hủy': 'secondary',
        'đã xử lý': 'success'
    };
    return colors[status] || 'secondary';
}

function getPriorityBadgeColor(priority) {
    const colors = {
        'thấp': 'success',
        'bình thường': 'info',
        'cao': 'warning',
        'khẩn cấp': 'danger'
    };
    return colors[priority] || 'secondary';
}

function getSeverityBadgeColor(severity) {
    const colors = {
        'cảnh cáo': 'warning',
        'kiểm điểm': 'orange',
        'kỷ luật': 'danger'
    };
    return colors[severity] || 'secondary';
}

// Export all
module.exports = {
    // Labels
    VIOLATION_TYPE_LABELS,
    VIOLATION_SEVERITY_LABELS,
    VIOLATION_STATUS_LABELS,
    MAINTENANCE_TYPE_LABELS,
    MAINTENANCE_PRIORITY_LABELS,
    MAINTENANCE_STATUS_LABELS,
    
    // Functions
    getViolationTypeLabel,
    getViolationSeverityLabel,
    getViolationStatusLabel,
    getMaintenanceTypeLabel,
    getMaintenancePriorityLabel,
    getMaintenanceStatusLabel,
    getPriorityScore,
    getSeverityScore,
    formatDateVN,
    calculateDaysBetween,
    getStatusBadgeColor,
    getPriorityBadgeColor,
    getSeverityBadgeColor
};
