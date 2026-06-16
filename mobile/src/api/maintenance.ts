import { api } from './client';

export const MAINTENANCE_TYPES = [
  { key: 'electrical', label: 'Điện', icon: 'flash-outline' },
  { key: 'plumbing', label: 'Nước', icon: 'water-outline' },
  { key: 'hvac', label: 'Điều hòa', icon: 'thermometer-outline' },
  { key: 'furniture', label: 'Nội thất', icon: 'cube-outline' },
  { key: 'door_lock', label: 'Khóa cửa', icon: 'key-outline' },
  { key: 'window', label: 'Cửa sổ', icon: 'apps-outline' },
  { key: 'internet', label: 'Internet', icon: 'wifi-outline' },
  { key: 'cleaning', label: 'Vệ sinh', icon: 'brush-outline' },
  { key: 'pest_control', label: 'Côn trùng', icon: 'bug-outline' },
  { key: 'other', label: 'Khác', icon: 'build-outline' },
] as const;

export const MAINTENANCE_PRIORITIES = [
  { key: 'low', label: 'Thấp' },
  { key: 'medium', label: 'Trung bình' },
  { key: 'high', label: 'Cao' },
  { key: 'urgent', label: 'Khẩn cấp' },
] as const;

export interface MaintenanceUpdate {
  addedBy: { name: string; role: string };
  message: string;
  addedAt: string;
}

export interface MaintenanceRequest {
  _id: string;
  requestNumber: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  reportedAt: string;
  updatedAt: string;
  dormitoryName: string;
  roomNumber: string;
  floorNumber: number;
  assignedTo?: { name: string; phone?: string };
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  estimatedCost?: number;
  actualCost?: number;
  completionNotes?: string;
  updates?: MaintenanceUpdate[];
  resolution?: { action?: string; notes?: string };
}

export interface CreateMaintenancePayload {
  type: string;
  title: string;
  description: string;
  priority?: string;
}

export async function fetchMyRequests(status?: string): Promise<MaintenanceRequest[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const { data } = await api.get<{ success: boolean; requests: MaintenanceRequest[] }>(
    '/mobile/maintenance/requests',
    { params }
  );
  return data.requests;
}

export async function createMaintenanceRequest(payload: CreateMaintenancePayload): Promise<MaintenanceRequest> {
  const { data } = await api.post<{ success: boolean; request: MaintenanceRequest }>(
    '/mobile/maintenance/requests',
    payload
  );
  return data.request;
}

export async function fetchRequestDetail(id: string): Promise<MaintenanceRequest> {
  const { data } = await api.get<{ success: boolean; request: MaintenanceRequest }>(
    `/mobile/maintenance/requests/${id}`
  );
  return data.request;
}
