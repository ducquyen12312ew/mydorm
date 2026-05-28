import { api } from './client';

export const VIOLATION_TYPE_LABELS: Record<string, string> = {
  noise: 'Ồn ào',
  alcohol: 'Rượu bia',
  smoking: 'Hút thuốc',
  late_return: 'Về muộn',
  unauthorized_guest: 'Khách không phép',
  damage: 'Hư hỏng tài sản',
  hygiene: 'Vi phạm vệ sinh',
  theft: 'Trộm cắp',
  violence: 'Bạo lực',
  other: 'Khác',
};

export interface Violation {
  _id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  reportedAt: string;
  dormitoryName?: string;
  roomNumber?: string;
  resolution?: {
    action?: string;
    notes?: string;
    fineAmount?: number;
  };
}

export interface Roommate {
  name: string;
  studentId: string;
  phone: string | null;
  checkInDate: string;
}

export interface RoommatesResponse {
  roommates: Roommate[];
  room: {
    roomNumber: string;
    floor: number;
    dormitoryName: string;
    maxCapacity: number;
  } | null;
}

export async function fetchMyViolations(): Promise<Violation[]> {
  const { data } = await api.get<{ success: boolean; violations: Violation[] }>(
    '/mobile/violations'
  );
  return data.violations;
}

export async function fetchRoommates(): Promise<RoommatesResponse> {
  const { data } = await api.get<{ success: boolean } & RoommatesResponse>(
    '/mobile/roommates'
  );
  return { roommates: data.roommates, room: data.room };
}

export async function updateProfile(payload: { phone?: string; email?: string }) {
  const { data } = await api.patch<{ success: boolean; user: any }>(
    '/mobile/profile',
    payload
  );
  return data.user;
}
