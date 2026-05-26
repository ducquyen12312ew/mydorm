import { api } from './client';

export interface DashboardProfile {
  id: string;
  name: string;
  studentId: string;
  email: string;
  phone: string;
  gender: string;
  faculty: string;
  academicYear: string;
  priorityScore: number;
  roomNumber?: string;
  dormitoryId?: string;
}

export interface DashboardApplication {
  id: string;
  status: string;
  roomNumber?: string;
  dormitoryId?: string;
  submittedAt: string;
  updatedAt: string;
  priorityScore: number;
}

export interface DashboardAssignment {
  status: 'assigned' | 'pending';
  roomNumber?: string;
  dormitoryName?: string;
  allocationType?: string;
  updatedAt?: string;
}

export interface DashboardCycle {
  id: string;
  name: string;
  status: string;
  registrationStart: string;
  registrationEnd: string;
}

export interface DashboardData {
  profile: DashboardProfile;
  application: DashboardApplication | null;
  assignment: DashboardAssignment;
  cycle: DashboardCycle | null;
  notifications: { unreadCount: number };
  syncAt: string;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get<{ success: boolean; dashboard: DashboardData }>('/mobile/dashboard');
  return data.dashboard;
}

export async function fetchProfile() {
  const { data } = await api.get<{ success: boolean; user: DashboardProfile }>('/mobile/me');
  return data.user;
}
