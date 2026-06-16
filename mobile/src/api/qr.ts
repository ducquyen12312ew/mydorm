import { api } from './client';

export interface QRTokenResponse {
  token: string;        // opaque backend-signed token — encode directly into QR
  expiresAt: string;   // ISO timestamp
  expiresIn: number;   // seconds
}

export async function generateQRToken(): Promise<QRTokenResponse> {
  const { data } = await api.post<{ success: boolean } & QRTokenResponse>('/mobile/qr/token');
  return { token: data.token, expiresAt: data.expiresAt, expiresIn: data.expiresIn };
}
