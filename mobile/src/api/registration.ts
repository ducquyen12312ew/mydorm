import { api } from './client';

export interface RegistrationWindow {
  id: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  allowedAcademicYears: string[];
}

export interface RegistrationAvailability {
  openForRegistration: boolean;
  message?: string;
  window?: RegistrationWindow;
}

export async function fetchRegistrationAvailability(): Promise<RegistrationAvailability> {
  const { data } = await api.get<{ success: boolean } & RegistrationAvailability>(
    '/mobile/registration/availability'
  );
  return { openForRegistration: data.openForRegistration, window: data.window, message: data.message };
}

export async function applyForRoom(): Promise<{ success: boolean; message: string; assignment?: any }> {
  const { data } = await api.post<any>('/student/apply');
  return data;
}
