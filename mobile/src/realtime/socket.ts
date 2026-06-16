import { io, Socket } from 'socket.io-client';
import { apiConfig } from '../config';
import { TokenStore } from '../api/client';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  // Disconnect any existing (disconnected) socket before creating a new one
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(apiConfig.baseUrl, {
    path: '/socket.io',
    // auth as a function — called fresh on every connection attempt including reconnects
    auth: (cb: (data: Record<string, string>) => void) => {
      TokenStore.getAccess().then((token) => {
        cb({ token: token ?? '' });
      });
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.3,
    timeout: 10000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function emitRefresh(): void {
  if (socket?.connected) {
    socket.emit('student:refresh');
  }
}

export function ensureConnected(): void {
  if (socket && !socket.connected) {
    socket.connect();
  }
}
