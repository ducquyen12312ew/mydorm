/**
 * FIXED PRIORITY CALCULATION SYSTEM
 * Hệ thống tính điểm ưu tiên CỐ ĐỊNH - không cần admin cấu hình
 * 
 * Công thức tính điểm (0-100%):
 * - Diện ưu tiên (priorityPolicies): 0-30 điểm
 * - Năm học (yearGroup): 0-25 điểm
 * - Học lực (GPA): 0-20 điểm
 * - Vi phạm (violations): -25 điểm (trừ điểm)
 * - Khoảng cách từ nhà: 0-10 điểm
 * - Tình hình gia đình: 0-15 điểm
 * 
 * Tổng tối đa: 100 điểm
 */

/**
 * Calculate priority score for a student
 * @param {Object} studentData - Student information
 * @param {Array} studentData.priorityPolicies - Array of priority types (e.g., ['ethnic', 'poor'])
 * @param {String} studentData.yearGroup - Year group: 'year1', 'year2_3', 'year4_plus'
 * @param {Number} studentData.gpa - GPA (0-4 scale)
 * @param {Array} studentData.violations - Array of violation records
 * @param {Number} studentData.distanceFromHome - Distance in km
 * @param {String} studentData.familyWealth - 'poor', 'average', 'wealthy'
 * @returns {Number} Priority score (0-100)
 */
function calculatePriorityScore(studentData) {
    let score = 0;
    const details = {
        priorityPolicies: 0,
        yearGroup: 0,
        gpa: 0,
        violations: 0,
        distance: 0,
        familyWealth: 0
    };

    // 1. DIỆN ƯU TIÊN (0-30 điểm)
    // Mỗi diện ưu tiên được 10 điểm, tối đa 3 diện
    const priorityPolicies = studentData.priorityPolicies || [];
    const priorityTypes = {
        'ethnic': 10,      // Dân tộc thiểu số
        'poor': 10,        // Hộ nghèo/cận nghèo
        'disability': 10,  // Khuyết tật
        'orphan': 10       // Mồ côi
    };
    
    priorityPolicies.forEach(policy => {
        if (priorityTypes[policy.type]) {
            details.priorityPolicies += priorityTypes[policy.type];
        }
    });
    details.priorityPolicies = Math.min(details.priorityPolicies, 30); // Tối đa 30 điểm

    // 2. NĂM HỌC (0-25 điểm)
    // Ưu tiên sinh viên năm cuối
    const yearWeights = {
        'year1': 5,         // Năm 1: 5 điểm
        'year2_3': 15,      // Năm 2-3: 15 điểm
        'year4_plus': 25    // Năm 4+: 25 điểm
    };
    details.yearGroup = yearWeights[studentData.yearGroup] || 0;

    // 3. HỌC LỰC (0-20 điểm)
    // GPA càng cao càng được ưu tiên
    const gpa = studentData.gpa || 0;
    if (gpa >= 3.6) {
        details.gpa = 20; // Xuất sắc
    } else if (gpa >= 3.2) {
        details.gpa = 15; // Giỏi
    } else if (gpa >= 2.5) {
        details.gpa = 10; // Khá
    } else if (gpa >= 2.0) {
        details.gpa = 5;  // Trung bình
    } else {
        details.gpa = 0;  // Yếu
    }

    // 4. VI PHẠM (-25 điểm)
    // Vi phạm sẽ TRỪ điểm
    const violations = studentData.violations || [];
    const activeViolations = violations.filter(v => 
        v.status === 'INVESTIGATING' || v.status === 'CONFIRMED'
    );
    
    activeViolations.forEach(violation => {
        if (violation.severity === 'CRITICAL') {
            details.violations -= 25; // Nghiêm trọng: -25 điểm
        } else if (violation.severity === 'MAJOR') {
            details.violations -= 15; // Nặng: -15 điểm
        } else if (violation.severity === 'MINOR') {
            details.violations -= 5;  // Nhẹ: -5 điểm
        }
    });

    // 5. KHOẢNG CÁCH TỪ NHÀ (0-10 điểm)
    // Sinh viên ở xa được ưu tiên hơn
    const distance = studentData.distanceFromHome || 0;
    if (distance >= 500) {
        details.distance = 10; // Trên 500km
    } else if (distance >= 200) {
        details.distance = 7;  // 200-500km
    } else if (distance >= 100) {
        details.distance = 5;  // 100-200km
    } else if (distance >= 50) {
        details.distance = 3;  // 50-100km
    } else {
        details.distance = 0;  // Dưới 50km
    }

    // 6. TÌNH HÌNH GIA ĐÌNH (0-15 điểm)
    const familyWeights = {
        'poor': 15,     // Nghèo
        'average': 7,   // Trung bình
        'wealthy': 0    // Giàu
    };
    details.familyWealth = familyWeights[studentData.familyWealth] || 7;

    // TỔNG ĐIỂM
    score = details.priorityPolicies 
          + details.yearGroup 
          + details.gpa 
          + details.violations 
          + details.distance 
          + details.familyWealth;

    // Đảm bảo điểm trong khoảng 0-100
    score = Math.max(0, Math.min(100, score));

    return {
        totalScore: Math.round(score),
        percentage: Math.round(score) + '%',
        details: details,
        breakdown: {
            'Diện ưu tiên': `${details.priorityPolicies}/30`,
            'Năm học': `${details.yearGroup}/25`,
            'Học lực': `${details.gpa}/20`,
            'Vi phạm': `${details.violations}`,
            'Khoảng cách': `${details.distance}/10`,
            'Gia đình': `${details.familyWealth}/15`
        }
    };
}

/**
 * Get priority level badge based on score
 * @param {Number} score - Priority score (0-100)
 * @returns {Object} Badge info with color and text
 */
function getPriorityBadge(score) {
    if (score >= 80) {
        return { level: 'Rất cao', color: '#dc3545', class: 'badge-danger' };
    } else if (score >= 60) {
        return { level: 'Cao', color: '#ff9800', class: 'badge-warning' };
    } else if (score >= 40) {
        return { level: 'Trung bình', color: '#17a2b8', class: 'badge-info' };
    } else if (score >= 20) {
        return { level: 'Thấp', color: '#6c757d', class: 'badge-secondary' };
    } else {
        return { level: 'Rất thấp', color: '#6c757d', class: 'badge-secondary' };
    }
}

module.exports = {
    calculatePriorityScore,
    getPriorityBadge
};
