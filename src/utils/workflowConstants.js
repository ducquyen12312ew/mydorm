/**
 * Workflow Constants & Utilities
 * Centralized definitions for application workflow steps and transitions
 */

// ════════════════════════════════════════════════════════════════════════════
// WORKFLOW STEP DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

const WORKFLOW_STEPS = {
  DRAFT: {
    id: 0,
    code: 'DRAFT',
    label: 'Nháp',
    viLabel: 'Nháp',
    icon: 'fas fa-pen-to-square',
    bgColor: '#f3f4f6',
    textColor: '#6b7280',
    description: 'Đơn chưa gửi'
  },
  
  SUBMITTED: {
    id: 1,
    code: 'SUBMITTED',
    label: 'Đã gửi',
    viLabel: 'Đã gửi',
    icon: 'fas fa-paper-plane',
    bgColor: '#dbeafe',
    textColor: '#1e40af',
    description: 'Đơn đã được gửi, đang chờ xử lý'
  },
  
  PENDING_REVIEW: {
    id: 2,
    code: 'PENDING_REVIEW',
    label: 'Đợi duyệt',
    viLabel: 'Đợi duyệt',
    icon: 'fas fa-hourglass-half',
    bgColor: '#fef3c7',
    textColor: '#92400e',
    description: 'Admin đang xem xét đơn'
  },
  
  UNDER_REVIEW: {
    id: 3,
    code: 'UNDER_REVIEW',
    label: 'Đang kiểm tra',
    viLabel: 'Đang kiểm tra',
    icon: 'fas fa-magnifying-glass',
    bgColor: '#fce7f3',
    textColor: '#831843',
    description: 'Admin đang kiểm tra chi tiết'
  },
  
  APPROVED: {
    id: 4,
    code: 'APPROVED',
    label: 'Đã duyệt',
    viLabel: 'Đã duyệt',
    icon: 'fas fa-check-circle',
    bgColor: '#dcfce7',
    textColor: '#166534',
    description: 'Đơn được chấp nhận'
  },
  
  APPROVED_AWAITING_PAYMENT: {
    id: 5,
    code: 'APPROVED_AWAITING_PAYMENT',
    label: 'Chờ thanh toán',
    viLabel: 'Chờ thanh toán',
    icon: 'fas fa-credit-card',
    bgColor: '#f0fdf4',
    textColor: '#15803d',
    description: 'Đơn được duyệt, chờ thanh toán phí'
  },
  
  REJECTED: {
    id: 6,
    code: 'REJECTED',
    label: 'Bị từ chối',
    viLabel: 'Bị từ chối',
    icon: 'fas fa-times-circle',
    bgColor: '#fee2e2',
    textColor: '#991b1b',
    description: 'Đơn không được chấp nhận'
  },
  
  WITHDRAWN: {
    id: 7,
    code: 'WITHDRAWN',
    label: 'Rút lại',
    viLabel: 'Rút lại',
    icon: 'fas fa-arrow-rotate-left',
    bgColor: '#f5f3ff',
    textColor: '#6d28d9',
    description: 'Sinh viên rút lại đơn'
  }
};

// ════════════════════════════════════════════════════════════════════════════
// WORKFLOW SEQUENCES & VALID TRANSITIONS
// ════════════════════════════════════════════════════════════════════════════

const WORKFLOW_SEQUENCE = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_REVIEW',
  'UNDER_REVIEW',
  'APPROVED',
  'APPROVED_AWAITING_PAYMENT'
];

const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['PENDING_REVIEW', 'WITHDRAWN'],
  PENDING_REVIEW: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['APPROVED_AWAITING_PAYMENT', 'WITHDRAWN'],
  APPROVED_AWAITING_PAYMENT: ['WITHDRAWN'],
  REJECTED: ['WITHDRAWN'],
  WITHDRAWN: []
};

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function getStepDetails(stepCode) {
  return WORKFLOW_STEPS[stepCode] || WORKFLOW_STEPS.DRAFT;
}

function isValidTransition(fromStep, toStep) {
  if (!VALID_TRANSITIONS[fromStep]) return false;
  return VALID_TRANSITIONS[fromStep].includes(toStep);
}

function getStepIcon(stepCode) {
  return WORKFLOW_STEPS[stepCode]?.icon || 'fas fa-circle';
}

function getStepLabel(stepCode) {
  return WORKFLOW_STEPS[stepCode]?.label || 'Không xác định';
}

function getStepColor(stepCode) {
  return WORKFLOW_STEPS[stepCode]?.bgColor || '#f3f4f6';
}

function getStepTextColor(stepCode) {
  return WORKFLOW_STEPS[stepCode]?.textColor || '#6b7280';
}

function getNextPossibleSteps(currentStep) {
  return VALID_TRANSITIONS[currentStep] || [];
}

function calculateProgress(currentStep) {
  const stepOrder = Object.values(WORKFLOW_STEPS);
  const index = stepOrder.findIndex(s => s.code === currentStep);
  if (index === -1) return 0;
  
  const totalSteps = WORKFLOW_SEQUENCE.length;
  return Math.round((index / totalSteps) * 100);
}

function isStepCompleted(stepCode, currentStep) {
  const currentIndex = WORKFLOW_SEQUENCE.indexOf(currentStep);
  const stepIndex = WORKFLOW_SEQUENCE.indexOf(stepCode);
  return stepIndex <= currentIndex;
}

function getStepsUpTo(stepCode) {
  const index = WORKFLOW_SEQUENCE.indexOf(stepCode);
  if (index === -1) return [];
  return WORKFLOW_SEQUENCE.slice(0, index + 1);
}

// ════════════════════════════════════════════════════════════════════════════
// DOCUMENT REQUIREMENTS
// ════════════════════════════════════════════════════════════════════════════

const REQUIRED_DOCUMENTS = {
  PERSONAL_ID: {
    code: 'PERSONAL_ID',
    name: 'CMND/CCCD',
    description: 'Chứng minh nhân dân hoặc căn cước công dân',
    isRequired: true,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf']
  },
  
  PAYMENT_PROOF: {
    code: 'PAYMENT_PROOF',
    name: 'Bằng chứng thanh toán',
    description: 'Hóa đơn thanh toán phí ký túc xá',
    isRequired: true,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf']
  },
  
  GUARDIAN_LETTER: {
    code: 'GUARDIAN_LETTER',
    name: 'Giấy phép phụ huynh',
    description: 'Giấy xác nhận từ phụ huynh (nếu dưới 18 tuổi)',
    isRequired: false,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf']
  },
  
  FINANCIAL_CERTIFICATE: {
    code: 'FINANCIAL_CERTIFICATE',
    name: 'Giấy xác nhận tài chính',
    description: 'Giấy xác nhận tình trạng kinh tế gia đình',
    isRequired: false,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf']
  },
  
  HEALTH_CERTIFICATE: {
    code: 'HEALTH_CERTIFICATE',
    name: 'Giấy xác nhận sức khỏe',
    description: 'Giấy xác nhận sức khỏe từ bệnh viện/phòng khám',
    isRequired: false,
    acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf']
  }
};

function getRequiredDocuments(forStep) {
  const docs = {};
  Object.entries(REQUIRED_DOCUMENTS).forEach(([key, doc]) => {
    if (doc.isRequired) {
      docs[key] = doc;
    }
  });
  return docs;
}

// ════════════════════════════════════════════════════════════════════════════
// ACTION TYPES & REASONS
// ════════════════════════════════════════════════════════════════════════════

const ACTION_TYPES = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  DOCUMENT_REQUESTED: 'DOCUMENT_REQUESTED',
  REOPENED: 'REOPENED'
};

const REJECTION_REASONS = {
  INCOMPLETE_INFO: { code: 'INCOMPLETE_INFO', label: 'Thông tin không đầy đủ' },
  INVALID_DOCUMENTS: { code: 'INVALID_DOCUMENTS', label: 'Tài liệu không hợp lệ' },
  POLICY_VIOLATION: { code: 'POLICY_VIOLATION', label: 'Vi phạm chính sách' },
  OTHER: { code: 'OTHER', label: 'Lý do khác' }
};

// ════════════════════════════════════════════════════════════════════════════
// TIMELINE EVENT TYPES
// ════════════════════════════════════════════════════════════════════════════

const TIMELINE_EVENT_TYPES = {
  APPLICATION_CREATED: 'APPLICATION_CREATED',
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  DOCUMENT_REQUESTED: 'DOCUMENT_REQUESTED',
  DOCUMENT_SUBMITTED: 'DOCUMENT_SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  ROOM_ASSIGNED: 'ROOM_ASSIGNED',
  WITHDRAWN: 'WITHDRAWN'
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════════════════

module.exports = {
  WORKFLOW_STEPS,
  WORKFLOW_SEQUENCE,
  VALID_TRANSITIONS,
  REQUIRED_DOCUMENTS,
  ACTION_TYPES,
  REJECTION_REASONS,
  TIMELINE_EVENT_TYPES,
  
  // Helper functions
  getStepDetails,
  isValidTransition,
  getStepIcon,
  getStepLabel,
  getStepColor,
  getStepTextColor,
  getNextPossibleSteps,
  calculateProgress,
  isStepCompleted,
  getStepsUpTo,
  getRequiredDocuments
};
